import { MINIPROGRAM_APP_VERSION, MINIPROGRAM_PLATFORM } from '../constants/app'

type MonitorLevel = 'info' | 'warn' | 'error'
type MonitorType = 'log' | 'track' | 'error'
type MonitorContext = Record<string, unknown>

type MonitorRecord = {
  schemaVersion: 1
  type: MonitorType
  timestamp: number
  context: MonitorContext
  level?: MonitorLevel
  message?: string
  name?: string
  properties?: Record<string, unknown>
  error?: {
    name: string
    message: string
    stack?: string
    value?: unknown
  }
}

type MonitorReporter = {
  report(record: MonitorRecord): void | Promise<void>
}

export type Monitor = {
  log: {
    info(message: string, context?: MonitorContext): void
    warn(message: string, context?: MonitorContext): void
    error(message: string, context?: MonitorContext): void
  }
  track(name: string, properties?: Record<string, unknown>): void
  captureError(error: unknown, context?: MonitorContext): void
}

const MONITOR_SCHEMA_VERSION = 1 as const
const REDACTED_VALUE = '[REDACTED]'
const SENSITIVE_FIELD_PATTERN = /(token|authorization|password|secret|cookie|phone|openid)/i
const UNKNOWN_ERROR_MESSAGE = '发生未知异常'

function createMonitor(options: {
  platform: string
  appVersion?: string
  getContext?: () => MonitorContext
  reporters?: MonitorReporter[]
  now?: () => number
}): Monitor {
  const reporters = options.reporters ?? []
  const now = options.now ?? Date.now

  function dispatch(record: MonitorRecord): void {
    for (const reporter of reporters) {
      try {
        Promise.resolve(reporter.report(record)).catch(() => undefined)
      } catch {
        // 监控上报不能影响用户业务。
      }
    }
  }

  function createRecord(
    type: MonitorType,
    payload: Omit<MonitorRecord, 'schemaVersion' | 'type' | 'timestamp' | 'context'>,
    context?: MonitorContext,
  ): MonitorRecord {
    let platformContext: MonitorContext = {}
    try {
      platformContext = options.getContext?.() ?? {}
    } catch {
      platformContext = { contextError: '读取平台上下文失败' }
    }
    const safeContext = sanitize({ ...platformContext, ...context })
    return {
      schemaVersion: MONITOR_SCHEMA_VERSION,
      type,
      timestamp: now(),
      context: withoutUndefined({
        platform: options.platform,
        appVersion: options.appVersion,
        ...(isObject(safeContext) ? safeContext : {}),
      }),
      ...payload,
    }
  }

  return {
    log: {
      info(message, context) {
        dispatch(createRecord('log', { level: 'info', message: sanitizeText(message) }, context))
      },
      warn(message, context) {
        dispatch(createRecord('log', { level: 'warn', message: sanitizeText(message) }, context))
      },
      error(message, context) {
        dispatch(createRecord('log', { level: 'error', message: sanitizeText(message) }, context))
      },
    },
    track(name, properties) {
      dispatch(
        createRecord('track', {
          name,
          properties: sanitize(properties ?? {}) as Record<string, unknown>,
        }),
      )
    },
    captureError(error, context) {
      dispatch(createRecord('error', { error: normalizeError(error) }, context))
    },
  }
}

function normalizeError(error: unknown): NonNullable<MonitorRecord['error']> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: sanitizeText(error.message),
      ...(error.stack ? { stack: sanitizeText(error.stack) } : {}),
    }
  }
  if (typeof error === 'string') {
    return { name: 'Error', message: sanitizeText(error) }
  }
  return { name: 'UnknownError', message: UNKNOWN_ERROR_MESSAGE, value: sanitize(error) }
}

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitize)
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        SENSITIVE_FIELD_PATTERN.test(key) ? REDACTED_VALUE : sanitize(entry),
      ]),
    )
  }
  return typeof value === 'string' ? sanitizeText(value) : value
}

function sanitizeText(value: string): string {
  return value.replace(
    /(\b(?:token|authorization|password|secret|cookie|phone|openid)\b\s*[:=]\s*)(?:Bearer\s+)?[^\s,;]+/gi,
    '$1[REDACTED]',
  )
}

function withoutUndefined(values: MonitorContext): MonitorContext {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined))
}

function isObject(value: unknown): value is MonitorContext {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function getPageRoute(): string | undefined {
  const pages = getCurrentPages()
  return pages[pages.length - 1]?.route
}

function getContext() {
  const accountInfo = wx.getAccountInfoSync().miniProgram

  return {
    envVersion: accountInfo.envVersion,
    appId: accountInfo.appId,
    page: getPageRoute(),
  }
}

function writeToConsole(record: MonitorRecord): void {
  const prefix = `[StudyCommit][${record.type}]`

  if (record.type === 'error' || record.level === 'error') {
    console.error(prefix, record)
  } else if (record.level === 'warn') {
    console.warn(prefix, record)
  } else {
    console.info(prefix, record)
  }
}

export const monitor = createMonitor({
  platform: MINIPROGRAM_PLATFORM,
  appVersion: MINIPROGRAM_APP_VERSION,
  getContext,
  reporters: [{ report: writeToConsole }],
})
