import {
  MONITOR_ERROR_NAMES,
  MONITOR_SCHEMA_VERSION,
  REDACTED_VALUE,
  SENSITIVE_FIELD_PATTERN,
  UNKNOWN_ERROR_MESSAGE,
} from './constants'

export { MONITOR_EVENTS, type MonitorEventName } from './events'
export {
  MONITOR_ERROR_NAMES,
  MONITOR_SCHEMA_VERSION,
  REDACTED_VALUE,
  SENSITIVE_FIELD_PATTERN,
  UNKNOWN_ERROR_MESSAGE,
} from './constants'

export type MonitorLevel = 'info' | 'warn' | 'error'
export type MonitorType = 'log' | 'track' | 'error'

export type MonitorContext = Record<string, unknown>

export type MonitorRecord = {
  schemaVersion: typeof MONITOR_SCHEMA_VERSION
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

export type MonitorReporter = {
  report(record: MonitorRecord): void | Promise<void>
}

export type MonitorOptions = {
  platform: string
  appVersion?: string
  getContext?: () => MonitorContext
  reporters?: MonitorReporter[]
  now?: () => number
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

  return value
}

function normalizeError(error: unknown): NonNullable<MonitorRecord['error']> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      ...(error.stack ? { stack: error.stack } : {}),
    }
  }

  if (typeof error === 'string') {
    return { name: MONITOR_ERROR_NAMES.STANDARD, message: error }
  }

  return {
    name: MONITOR_ERROR_NAMES.UNKNOWN,
    message: UNKNOWN_ERROR_MESSAGE,
    value: sanitize(error),
  }
}

function withoutUndefined(values: MonitorContext): MonitorContext {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined))
}

export function createMonitor(options: MonitorOptions): Monitor {
  const reporters = options.reporters ?? []
  const now = options.now ?? Date.now

  function getBaseContext(): MonitorContext {
    let platformContext: MonitorContext = {}

    try {
      platformContext = options.getContext?.() ?? {}
    } catch {
      platformContext = { contextError: '读取平台上下文失败' }
    }

    return withoutUndefined({
      platform: options.platform,
      appVersion: options.appVersion,
      ...platformContext,
    })
  }

  function dispatch(record: MonitorRecord): void {
    for (const reporter of reporters) {
      try {
        Promise.resolve(reporter.report(record)).catch(() => undefined)
      } catch {
        // 监控上报不能影响用户业务，继续尝试其他 reporter。
      }
    }
  }

  function createRecord(
    type: MonitorType,
    payload: Omit<MonitorRecord, 'schemaVersion' | 'type' | 'timestamp' | 'context'>,
    context?: MonitorContext,
  ): MonitorRecord {
    const sanitizedContext = sanitize(context ?? {})
    const safeContext =
      sanitizedContext && typeof sanitizedContext === 'object' && !Array.isArray(sanitizedContext)
        ? (sanitizedContext as MonitorContext)
        : {}

    return {
      schemaVersion: MONITOR_SCHEMA_VERSION,
      type,
      timestamp: now(),
      context: withoutUndefined({ ...getBaseContext(), ...safeContext }),
      ...payload,
    }
  }

  return {
    log: {
      info(message, context) {
        dispatch(
          createRecord('log', { level: 'info', message: sanitize(message) as string }, context),
        )
      },
      warn(message, context) {
        dispatch(
          createRecord('log', { level: 'warn', message: sanitize(message) as string }, context),
        )
      },
      error(message, context) {
        dispatch(
          createRecord('log', { level: 'error', message: sanitize(message) as string }, context),
        )
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
