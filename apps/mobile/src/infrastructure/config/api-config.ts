import { createHttpError } from '@studycommit/common/http'

export function getMobileApiOrigin(): string {
  const origin = process.env.EXPO_PUBLIC_STUDYCOMMIT_API_ORIGIN
  if (!origin) {
    throw createHttpError({
      code: 'CONFIGURATION_ERROR',
      message: '缺少 EXPO_PUBLIC_STUDYCOMMIT_API_ORIGIN',
    })
  }
  return origin
}

export function getMobileApiPrefix(): string {
  return process.env.EXPO_PUBLIC_STUDYCOMMIT_API_PREFIX || '/api'
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
