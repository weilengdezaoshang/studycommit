import { createHttpError } from './http-error'

export interface ApiUrlOptions {
  origin: string
  apiPrefix: string
  path: string
  allowInsecureHttp?: boolean
}

const DANGEROUS_PROTOCOL = /^(javascript|data|file|vbscript):/i

export function createApiUrl(options: ApiUrlOptions): URL {
  const originUrl = parseOrigin(options.origin, options.allowInsecureHttp === true)
  const prefix = normalizeApiPrefix(options.apiPrefix)
  const path = normalizeBusinessPath(options.path)
  return new URL(`${originUrl.origin}${prefix}${path}`)
}

function parseOrigin(origin: string, allowInsecureHttp: boolean): URL {
  let originUrl: URL
  try {
    originUrl = new URL(origin)
  } catch {
    throw createHttpError({ code: 'CONFIGURATION_ERROR', message: 'API Origin 无效' })
  }

  if (originUrl.username || originUrl.password) {
    throw createHttpError({ code: 'CONFIGURATION_ERROR', message: 'API Origin 无效' })
  }
  if (originUrl.search || originUrl.hash) {
    throw createHttpError({ code: 'CONFIGURATION_ERROR', message: 'API Origin 无效' })
  }
  if (originUrl.pathname !== '/' && originUrl.pathname !== '') {
    throw createHttpError({ code: 'CONFIGURATION_ERROR', message: 'API Origin 不能包含业务路径' })
  }
  if (originUrl.protocol !== 'https:' && originUrl.protocol !== 'http:') {
    throw createHttpError({ code: 'CONFIGURATION_ERROR', message: 'API Origin 协议不受支持' })
  }
  if (originUrl.protocol === 'http:' && !allowInsecureHttp) {
    throw createHttpError({ code: 'CONFIGURATION_ERROR', message: '生产环境只允许 HTTPS' })
  }
  return originUrl
}

function normalizeApiPrefix(apiPrefix: string): string {
  const prefix = apiPrefix.trim()
  if (!prefix || prefix.includes('://') || prefix.startsWith('//') || prefix.includes('..')) {
    throw createHttpError({ code: 'CONFIGURATION_ERROR', message: 'API Prefix 无效' })
  }
  const withSlash = prefix.startsWith('/') ? prefix : `/${prefix}`
  return withSlash.endsWith('/') ? withSlash.slice(0, -1) : withSlash
}

function normalizeBusinessPath(path: string): string {
  const value = path.trim()
  if (
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('://') ||
    value.includes('..') ||
    DANGEROUS_PROTOCOL.test(value)
  ) {
    throw createHttpError({ code: 'INVALID_RESPONSE', message: '请求路径不受支持' })
  }
  return value
}
