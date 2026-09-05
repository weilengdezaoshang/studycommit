import { callOrpc, createApiOrpcClient } from '@studycommit/common/adapters/orpc'
import type { CurrentUser } from '@studycommit/rpc-contracts/auth'
import type { AuthTokens } from '@studycommit/rpc-contracts/auth'
import {
  allowsInsecureHttpFor,
  getMobileApiOrigin,
  getMobileApiPrefix,
} from '../../infrastructure/config/api-config'
import { setAuthSession } from '../../infrastructure/auth/session-store'

function createClient() {
  return createApiOrpcClient({
    origin: getMobileApiOrigin(),
    apiPrefix: getMobileApiPrefix(),
    allowInsecureHttp: allowsInsecureHttpFor(getMobileApiOrigin()),
    getHeaders: async () => ({ accept: 'application/json' }),
  })
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return '网络异常，请稍后重试'
}

export async function registerAccount(
  account: string,
  password: string,
  nickname?: string,
): Promise<void> {
  try {
    await callOrpc(() =>
      createClient().auth.registerAccount(
        nickname ? { account, password, nickname } : { account, password },
        { context: {} },
      ),
    )
  } catch (error) {
    throw new Error(toErrorMessage(error))
  }
}

export async function loginWithAccount(account: string, password: string): Promise<void> {
  let response: { user: CurrentUser; tokens: AuthTokens }
  try {
    response = await callOrpc(() =>
      createClient().auth.loginAccount(
        { account, password, deviceType: 'mobile' as const },
        { context: {} },
      ),
    )
  } catch (error) {
    throw new Error(toErrorMessage(error))
  }
  setAuthSession({ user: response.user, tokens: response.tokens })
}
