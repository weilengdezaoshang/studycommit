import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { app, safeStorage } from 'electron'
import { HttpError } from '@studycommit/common/http'
import {
  authTokensSchema,
  currentUserSchema,
  type AuthTokens,
  type CurrentUser,
} from '@studycommit/rpc-contracts/auth'

export type DesktopPersistedSession = { user: CurrentUser; tokens: AuthTokens }

export type SessionPersist = {
  read(): string | null
  write(value: string): void
  clear(): void
}

const REFRESH_SKEW_MS = 30_000
const SESSION_FILE = 'studycommit-auth-session'

export class DesktopAuthSessionStore {
  private session: DesktopPersistedSession | null = null
  private refreshHandler: ((refreshToken: string) => Promise<AuthTokens>) | null = null
  private refreshing: Promise<void> | null = null

  constructor(private readonly persist: SessionPersist = createFileSessionPersist()) {
    this.restore()
  }

  bindRefresh(handler: (refreshToken: string) => Promise<AuthTokens>) {
    this.refreshHandler = handler
  }

  getSession(): DesktopPersistedSession | null {
    return this.session
  }

  setSession(session: DesktopPersistedSession) {
    this.session = session
    this.persist.write(JSON.stringify(session))
  }

  clear() {
    this.session = null
    this.persist.clear()
  }

  async authorizationHeaders(): Promise<Record<string, string>> {
    await this.ensureFresh()
    const token = this.session?.tokens.accessToken
    return token ? { authorization: `Bearer ${token}` } : {}
  }

  async ensureFresh(): Promise<void> {
    const current = this.session
    if (!current || !isAccessExpired(current) || !this.refreshHandler) {
      return
    }
    if (!this.refreshing) {
      this.refreshing = this.doRefresh(current.tokens.refreshToken)
    }
    const pending = this.refreshing
    try {
      await pending
    } finally {
      if (this.refreshing === pending) {
        this.refreshing = null
      }
    }
  }

  private restore() {
    const raw = this.persist.read()
    if (!raw) {
      return
    }
    try {
      const parsed = JSON.parse(raw) as DesktopPersistedSession
      const user = currentUserSchema.safeParse(parsed.user)
      const tokens = authTokensSchema.safeParse(parsed.tokens)
      if (user.success && tokens.success) {
        this.session = { user: user.data, tokens: tokens.data }
        return
      }
    } catch {
      // 损坏的会话文件视为未登录
    }
    this.persist.clear()
  }

  private async doRefresh(refreshToken: string) {
    const current = this.session
    if (!current || !this.refreshHandler) {
      return
    }
    try {
      const tokens = await this.refreshHandler(refreshToken)
      if (this.session?.tokens.refreshToken !== refreshToken) {
        return
      }
      this.setSession({ user: current.user, tokens })
    } catch (error) {
      if (error instanceof HttpError && error.code === 'UNAUTHORIZED') {
        if (this.session?.tokens.refreshToken === refreshToken) {
          this.clear()
        }
      }
    }
  }
}

export function isAccessExpired(session: DesktopPersistedSession, now = Date.now()): boolean {
  const expiresAt = Date.parse(session.tokens.expiresAt)
  return Number.isNaN(expiresAt) || expiresAt - now <= REFRESH_SKEW_MS
}

export function createMemorySessionPersist(initial?: string | null): SessionPersist {
  let value = initial ?? null
  return {
    read: () => value,
    write: (next) => {
      value = next
    },
    clear: () => {
      value = null
    },
  }
}

export function createFileSessionPersist(): SessionPersist {
  return {
    read() {
      try {
        const file = sessionFile()
        if (!file || !existsSync(file)) {
          return null
        }
        const raw = readFileSync(file)
        if (safeStorage.isEncryptionAvailable()) {
          return safeStorage.decryptString(raw)
        }
        return raw.toString('utf8')
      } catch {
        return null
      }
    },
    write(value: string) {
      try {
        const file = sessionFile()
        if (!file) {
          return
        }
        mkdirSync(dirname(file), { recursive: true })
        const payload = safeStorage.isEncryptionAvailable()
          ? safeStorage.encryptString(value)
          : Buffer.from(value, 'utf8')
        writeFileSync(file, payload, { mode: 0o600 })
      } catch {
        // 持久化失败不影响内存会话
      }
    },
    clear() {
      try {
        const file = sessionFile()
        if (file) {
          rmSync(file, { force: true })
        }
      } catch {
        // ignore
      }
    },
  }
}

function sessionFile(): string | null {
  try {
    return join(app.getPath('userData'), SESSION_FILE)
  } catch {
    return null
  }
}
