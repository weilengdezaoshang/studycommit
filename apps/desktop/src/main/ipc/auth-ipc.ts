import { sendPhoneCodeInputSchema, verifyPhoneInputSchema } from '@studycommit/rpc-contracts/auth'
import type { DesktopAuthApiPort } from '../auth/auth-client'
import { authIpcChannels } from '../../shared/auth-channels'
import { parseIpcInput, type IpcHost } from './ipc-host'

export { authIpcChannels }

export function registerAuthIpc(host: IpcHost, auth: DesktopAuthApiPort): void {
  host.handle(authIpcChannels.sendPhoneCode, (input) => {
    const { phone } = parseIpcInput<{ phone: string }>(sendPhoneCodeInputSchema, input ?? {})
    return auth.sendPhoneCode(phone)
  })
  host.handle(authIpcChannels.verifyPhone, (input) => {
    const { phone, code } = parseIpcInput<{ phone: string; code: string }>(
      verifyPhoneInputSchema,
      input ?? {},
    )
    // deviceType 由主进程强制为 desktop,不信任渲染进程传值
    return auth.verifyPhone(phone, code)
  })
}
