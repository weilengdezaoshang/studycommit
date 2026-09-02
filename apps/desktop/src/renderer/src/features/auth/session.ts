import { useSyncExternalStore } from 'react'

/** 渲染进程只保留用户资料；访问/刷新令牌放在主进程。 */
export type DesktopAuthSession = {
  user: { id: string; nickname: string; avatarUrl: string | null; status: string }
  tokens?: { accessToken: string; refreshToken: string; expiresAt: string }
}

const SESSION_KEY = 'studycommit.desktop.auth.session.v1'

const listeners = new Set<() => void>()

function readSession(): DesktopAuthSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as DesktopAuthSession
    if (!parsed?.user?.id) {
      return null
    }
    return { user: parsed.user }
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
  window.localStorage.setItem(SESSION_KEY, JSON.stringify({ user: session.user }))
  emit()
}

export function clearAuthSession() {
  window.localStorage.removeItem(SESSION_KEY)
  emit()
}
