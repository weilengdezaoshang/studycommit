import Constants from 'expo-constants'
import { createHttpError } from '@studycommit/common/http'

type MobileExtra = {
  studycommitApiOrigin?: unknown
  studycommitApiPrefix?: unknown
  studycommitDevUserId?: unknown
}

function readMobileExtra(): MobileExtra {
  const extra = Constants.expoConfig?.extra
  return extra && typeof extra === 'object' ? (extra as MobileExtra) : {}
}

function readExtraString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

export function getMobileApiOrigin(): string {
  const origin =
    readExtraString(readMobileExtra().studycommitApiOrigin) ??
    process.env.EXPO_PUBLIC_STUDYCOMMIT_API_ORIGIN
  if (!origin) {
    throw createHttpError({
      code: 'CONFIGURATION_ERROR',
      message: '缺少 EXPO_PUBLIC_STUDYCOMMIT_API_ORIGIN',
    })
  }
  return origin
}

export function getMobileApiPrefix(): string {
  return (
    readExtraString(readMobileExtra().studycommitApiPrefix) ??
    process.env.EXPO_PUBLIC_STUDYCOMMIT_API_PREFIX ??
    '/api'
  )
}

export function getMobileDevelopmentUserId(): string | undefined {
  if (typeof __DEV__ !== 'undefined' && !__DEV__) {
    return undefined
  }
  return readExtraString(readMobileExtra().studycommitDevUserId)
}

export function createDevelopmentHeaderProvider(
  userId?: string,
): () => Promise<Readonly<Record<string, string>>> {
  return async () => {
    const headers: Record<string, string> = { accept: 'application/json' }
    if (userId) {
      headers['x-user-id'] = userId
    }
    return headers
  }
}
