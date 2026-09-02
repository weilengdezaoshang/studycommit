import { HttpError } from '@studycommit/common/http'
import type { AuthTokens, CurrentUser } from '@studycommit/rpc-contracts/auth'
import {
  accountRegisterOutputSchema,
  verifyPhoneOutputSchema,
} from '@studycommit/rpc-contracts/auth'
import {
  allowsInsecureHttpFor,
  getMobileApiOrigin,
  getMobileApiPrefix,
} from '../../infrastructure/config/api-config'
import { ReactNativeFetchTransport } from '../../infrastructure/http/react-native-fetch-transport'
import { setAuthSession } from '../../infrastructure/auth/session-store'

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

export async function registerAccount(account: string, password: string): Promise<void> {
  try {
    await createTransport().request({
      method: 'POST',
      path: '/auth/account/register',
      body: { account, password },
      responseSchema: accountRegisterOutputSchema,
    })
  } catch (error) {
    throw new Error(toErrorMessage(error))
  }
}

export async function loginWithAccount(account: string, password: string): Promise<void> {
  let response: { user: CurrentUser; tokens: AuthTokens }
  try {
    response = await createTransport().request({
      method: 'POST',
      path: '/auth/account/login',
      body: { account, password, deviceType: 'mobile' },
      responseSchema: verifyPhoneOutputSchema,
    })
  } catch (error) {
    throw new Error(toErrorMessage(error))
  }
  setAuthSession({ user: response.user, tokens: response.tokens })
}
