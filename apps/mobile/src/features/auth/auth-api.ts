import { HttpError } from '@studycommit/common/http'
import type { AuthTokens, CurrentUser } from '@studycommit/rpc-contracts/auth'
import { sendPhoneCodeOutputSchema, verifyPhoneOutputSchema } from '@studycommit/rpc-contracts/auth'
import {
  allowsInsecureHttpFor,
  getMobileApiOrigin,
  getMobileApiPrefix,
} from '../../infrastructure/config/api-config'
import { ReactNativeFetchTransport } from '../../infrastructure/http/react-native-fetch-transport'
import { setAuthSession } from '../../infrastructure/auth/session-store'

/**
 * 登录注册 API:对齐后端 AuthController
 *   POST /auth/phone/code   { phone } -> { expiresInSeconds }
 *   POST /auth/phone/verify { phone, code, deviceType: 'mobile' } -> { user, tokens }
 * 懒构建 transport,避免缺少 EXPO_PUBLIC_STUDYCOMMIT_API_ORIGIN 时在导入期抛错。
 */

function createTransport() {
  return new ReactNativeFetchTransport({
    origin: getMobileApiOrigin(),
    apiPrefix: getMobileApiPrefix(),
    allowInsecureHttp: allowsInsecureHttpFor(getMobileApiOrigin()),
    defaultTimeoutMs: 10_000,
    getHeaders: async () => ({ accept: 'application/json' }),
  })
}

function toErrorMessage(error: unknown): string {
  if (error instanceof HttpError) {
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return '网络异常，请稍后重试'
}

export async function requestPhoneCode(phone: string): Promise<void> {
  try {
    await createTransport().request({
      method: 'POST',
      path: '/auth/phone/code',
      body: { phone },
      responseSchema: sendPhoneCodeOutputSchema,
    })
  } catch (error) {
    throw new Error(toErrorMessage(error))
  }
}

export async function verifyPhoneLogin(phone: string, code: string): Promise<void> {
  let response: { user: CurrentUser; tokens: AuthTokens }
  try {
    response = await createTransport().request({
      method: 'POST',
      path: '/auth/phone/verify',
      body: { phone, code, deviceType: 'mobile' },
      responseSchema: verifyPhoneOutputSchema,
    })
  } catch (error) {
    throw new Error(toErrorMessage(error))
  }
  setAuthSession({ user: response.user, tokens: response.tokens })
}
