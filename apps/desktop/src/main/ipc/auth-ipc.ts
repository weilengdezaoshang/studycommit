import {
  accountLoginInputSchema,
  accountRegisterInputSchema,
} from '@studycommit/rpc-contracts/auth'
import type { DesktopAuthApiPort } from '../auth/auth-client'
import { authIpcChannels } from '../../shared/auth-channels'
import { parseIpcInput, type IpcHost } from './ipc-host'

export { authIpcChannels }

export function registerAuthIpc(
  host: IpcHost,
  auth: DesktopAuthApiPort,
  onLogin?: () => void,
): void {
  host.handle(authIpcChannels.registerAccount, (input) => {
    const { account, password } = parseIpcInput<{ account: string; password: string }>(
      accountRegisterInputSchema,
      input ?? {},
    )
    return auth.registerAccount(account, password)
  })
  host.handle(authIpcChannels.loginAccount, async (input) => {
    const { account, password } = parseIpcInput<{ account: string; password: string }>(
      accountLoginInputSchema.omit({ deviceType: true }),
      input ?? {},
    )
    const session = await auth.loginAccount(account, password)
    // 登录成功后启用截图快捷键(DE-310:登录后才注册)
    onLogin?.()
    return session
  })
}
