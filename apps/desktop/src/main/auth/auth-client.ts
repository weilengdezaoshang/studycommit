import { sendPhoneCodeOutputSchema, verifyPhoneOutputSchema } from '@studycommit/rpc-contracts/auth'
import type { ElectronNetTransport } from '../http/electron-net-transport'

/**
 * 桌面端认证客户端:对齐后端 AuthController,
 * deviceType 固定为 'desktop'(PRD:桌面端扫码优先,验证码为兜底)。
 */
export type DesktopAuthApiPort = Pick<DesktopAuthApi, 'sendPhoneCode' | 'verifyPhone'>

export class DesktopAuthApi {
  constructor(private readonly transport: ElectronNetTransport) {}

  sendPhoneCode(phone: string) {
    return this.transport.request({
      method: 'POST',
      path: '/auth/phone/code',
      body: { phone },
      responseSchema: sendPhoneCodeOutputSchema,
    })
  }

  verifyPhone(phone: string, code: string) {
    return this.transport.request({
      method: 'POST',
      path: '/auth/phone/verify',
      body: { phone, code, deviceType: 'desktop' as const },
      responseSchema: verifyPhoneOutputSchema,
    })
  }
}
