import {
  accountRegisterOutputSchema,
  authTokensSchema,
  verifyPhoneOutputSchema,
} from '@studycommit/rpc-contracts/auth'
import type { ElectronNetTransport } from '../http/electron-net-transport'
import type { DesktopAuthSessionStore } from './session-store'

export type DesktopAuthApiPort = Pick<DesktopAuthApi, 'registerAccount' | 'loginAccount'>

export class DesktopAuthApi {
  constructor(
    private readonly sessions: DesktopAuthSessionStore,
    private readonly publicTransport: ElectronNetTransport,
  ) {}

  registerAccount(account: string, password: string) {
    return this.publicTransport.request({
      method: 'POST',
      path: '/auth/account/register',
      body: { account, password },
      responseSchema: accountRegisterOutputSchema,
    })
  }

  async loginAccount(account: string, password: string) {
    const session = await this.publicTransport.request({
      method: 'POST',
      path: '/auth/account/login',
      body: { account, password, deviceType: 'desktop' as const },
      responseSchema: verifyPhoneOutputSchema,
    })
    this.sessions.setSession(session)
    return session
  }

  refresh(refreshToken: string) {
    return this.publicTransport.request({
      method: 'POST',
      path: '/auth/token/refresh',
      body: { refreshToken },
      responseSchema: authTokensSchema,
    })
  }
}
