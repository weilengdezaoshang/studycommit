import { useSyncExternalStore } from 'react'
import * as SecureStore from 'expo-secure-store'
import {
  authTokensSchema,
  currentUserSchema,
  type AuthTokens,
  type CurrentUser,
} from '@studycommit/rpc-contracts/auth'
import { getMobileApiOrigin, getMobileApiPrefix } from '../config/api-config'

export type AuthSession = { user: CurrentUser; tokens: AuthTokens }

const SESSION_KEY = 'studycommit.auth.session.v1'
/** 访问令牌到期前 30 秒即视为临期,主动用刷新令牌续期。 */
const REFRESH_SKEW_MS = 30_000

const listeners = new Set<() => void>()

type GateState = {
  hydrated: boolean
  session: AuthSession | null
  refreshing: Promise<boolean> | null
}

let gate: GateState = { hydrated: false, session: null, refreshing: null }

function emit() {
  for (const listener of listeners) {
    listener()
  }
}

export function subscribeAuthSession(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getAuthGate(): GateState {
  return gate
}

export function useAuthGate(): GateState {
  return useSyncExternalStore(subscribeAuthSession, getAuthGate, getAuthGate)
}

export function useAuthSession(): AuthSession | null {
  return useAuthGate().session
}

export function setAuthSession(next: AuthSession) {
  gate = { ...gate, session: next }
  emit()
  void persistSession(next)
}

export function clearAuthSession() {
  gate = { ...gate, session: null, refreshing: null }
  emit()
  void SecureStore.deleteItemAsync(SESSION_KEY).catch(() => undefined)
}

let hydrating: Promise<void> | null = null

/** 应用启动时从安全存储恢复会话;失败视为未登录。同一进程只水合一遍。 */
export async function hydrateAuthSession(): Promise<void> {
  if (!hydrating) {
    hydrating = restoreAuthSession()
  }
  return hydrating
}

async function restoreAuthSession(): Promise<void> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY)
    if (!raw) {
      gate = { ...gate, session: null }
      return
    }
    const parsed = JSON.parse(raw) as { user?: unknown; tokens?: unknown }
    const user = currentUserSchema.safeParse(parsed.user)
    const tokens = authTokensSchema.safeParse(parsed.tokens)
    gate = {
      ...gate,
      session: user.success && tokens.success ? { user: user.data, tokens: tokens.data } : null,
    }
    if (!user.success || !tokens.success) {
      await SecureStore.deleteItemAsync(SESSION_KEY).catch(() => undefined)
    }
  } catch {
    gate = { ...gate, session: null }
  } finally {
    gate = { ...gate, hydrated: true }
    emit()
  }
}

function isExpired(session: AuthSession): boolean {
  const expiresAt = Date.parse(session.tokens.expiresAt)
  return Number.isNaN(expiresAt) || expiresAt - Date.now() <= REFRESH_SKEW_MS
}

/** 单 flight:并发请求只触发一次刷新;失败(含刷新令牌失效)则清除会话。 */
async function ensureFreshSession(): Promise<boolean> {
  const current = gate.session
  if (!current || !isExpired(current)) {
    return Boolean(current)
  }
  if (!gate.refreshing) {
    gate = { ...gate, refreshing: doRefresh(current.tokens.refreshToken) }
  }
  const refreshing = gate.refreshing
  const ok = (await refreshing) === true
  gate = { ...gate, refreshing: null }
  return ok && Boolean(gate.session)
}

async function doRefresh(refreshToken: string): Promise<boolean> {
  try {
    const origin = getMobileApiOrigin()
    const prefix = getMobileApiPrefix()
    const response = await fetch(`${origin}${prefix}/auth/token/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    if (!response.ok) {
      clearAuthSession()
      return false
    }
    const parsed = authTokensSchema.safeParse(await response.json())
    if (!parsed.success || !gate.session) {
      clearAuthSession()
      return false
    }
    const next: AuthSession = { user: gate.session.user, tokens: parsed.data }
    gate = { ...gate, session: next }
    emit()
    void persistSession(next)
    return true
  } catch {
    // 网络异常不退出登录,保留当前会话待下次重试
    return Boolean(gate.session)
  }
}

/** 已登录时为请求附带 Bearer 令牌;临期自动刷新。 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  if (!gate.hydrated || !gate.session) {
    return {}
  }
  await ensureFreshSession()
  if (!gate.session) {
    return {}
  }
  return { authorization: `Bearer ${gate.session.tokens.accessToken}` }
}

async function persistSession(session: AuthSession) {
  try {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session))
  } catch {
    // 持久化失败不影响内存会话
  }
}

void hydrateAuthSession()
