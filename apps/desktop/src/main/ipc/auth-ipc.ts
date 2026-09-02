import {
  accountLoginInputSchema,
  accountRegisterInputSchema,
} from '@studycommit/rpc-contracts/auth'
import type { DesktopAuthApiPort } from '../auth/auth-client'
import { authIpcChannels } from '../../shared/auth-channels'
import { parseIpcInput, type IpcHost } from './ipc-host'

export { authIpcChannels }

export function registerAuthIpc(host: IpcHost, auth: DesktopAuthApiPort): void {
  host.handle(authIpcChannels.registerAccount, (input) => {
    const { account, password } = parseIpcInput<{ account: string; password: string }>(
      accountRegisterInputSchema,
      input ?? {},
    )
    return auth.registerAccount(account, password)
  })
  host.handle(authIpcChannels.loginAccount, (input) => {
    const { account, password } = parseIpcInput<{ account: string; password: string }>(
      accountLoginInputSchema.omit({ deviceType: true }),
      input ?? {},
    )
    return auth.loginAccount(account, password)
  })
}
