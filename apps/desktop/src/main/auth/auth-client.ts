import { callOrpc, type ApiOrpcClient } from '@studycommit/common/adapters/orpc'
import type { DesktopAuthSessionStore } from './session-store'

export type DesktopAuthApiPort = Pick<DesktopAuthApi, 'registerAccount' | 'loginAccount'>

export class DesktopAuthApi {
  constructor(
    private readonly sessions: DesktopAuthSessionStore,
    private readonly client: ApiOrpcClient,
  ) {}

  registerAccount(account: string, password: string) {
    return callOrpc(() => this.client.auth.registerAccount({ account, password }, { context: {} }))
  }

  async loginAccount(account: string, password: string) {
    const session = await callOrpc(() =>
      this.client.auth.loginAccount(
        { account, password, deviceType: 'desktop' as const },
        { context: {} },
      ),
    )
    this.sessions.setSession(session)
    return session
  }

  refresh(refreshToken: string) {
    return callOrpc(() => this.client.auth.refreshToken({ refreshToken }, { context: {} }))
  }
}
