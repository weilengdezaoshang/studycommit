import type { Params } from 'nestjs-pino'
import type { Options } from 'pino-http'

export type RuntimeEnvironment = 'development' | 'test' | 'production'

export interface LoggingConfig extends Params {
  pinoHttp: Options
}

const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.password',
  'req.body.token',
  'req.body.accessToken',
  'req.body.refreshToken',
  'res.headers["set-cookie"]',
]

export function createLoggingConfig(environment: RuntimeEnvironment): LoggingConfig {
  const isDevelopment = environment === 'development'

  return {
    pinoHttp: {
      level: environment === 'test' ? 'silent' : isDevelopment ? 'debug' : 'info',
      base: {
        service: 'studycommit-api',
        environment,
      },
      redact: {
        paths: REDACTED_PATHS,
        censor: '[REDACTED]',
      },
      ...(isDevelopment
        ? {
            transport: {
              target: 'pino-pretty',
              options: {
                colorize: true,
                singleLine: false,
                translateTime: 'SYS:standard',
              },
            },
          }
        : {}),
    },
  }
}
