import type { AdminRole } from '@/auth/capabilities'

export interface AdminSession {
  userId: string
  role: AdminRole
  accessToken: string
  nickname?: string | null
}

let session: AdminSession | null = null
const listeners = new Set<() => void>()

export function getSession(): AdminSession | null {
  return session
}

export function getAccessToken(): string | null {
  return session?.accessToken ?? null
}

export function setSession(next: AdminSession | null) {
  session = next
  for (const listener of listeners) {
listener()
}
}

export function clearSession() {
  setSession(null)
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
