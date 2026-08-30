import { useSyncExternalStore } from 'react'

/**
 * 桌面端会话状态:localStorage 持久化(布局优先)。
 * 令牌刷新与安全存储归档将在接入真实会话生命周期时补齐。
 */
export type DesktopAuthSession = {
  user: { id: string; nickname: string; avatarUrl: string | null; status: string }
  tokens: { accessToken: string; refreshToken: string; expiresAt: string }
}

const SESSION_KEY = 'studycommit.desktop.auth.session.v1'

const listeners = new Set<() => void>()

function readSession(): DesktopAuthSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as DesktopAuthSession) : null
  } catch {
    return null
  }
}

let snapshot: DesktopAuthSession | null = readSession()

function emit() {
  snapshot = readSession()
  for (const listener of listeners) {
    listener()
  }
}

export function subscribeSession(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getSessionSnapshot() {
  return snapshot
}

export function useAuthSession(): DesktopAuthSession | null {
  return useSyncExternalStore(subscribeSession, getSessionSnapshot, getSessionSnapshot)
}

export function setAuthSession(session: DesktopAuthSession) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  emit()
}

export function clearAuthSession() {
  window.localStorage.removeItem(SESSION_KEY)
  emit()
}
