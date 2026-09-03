import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { AppError } from './app.error'

type LogContext = Record<string, unknown>

export interface ErrorLogger {
  warn(context: LogContext, message: string): void
  error(context: LogContext, message: string): void
}

interface ErrorPayload {
  code: string
  message: string
  details: unknown
}

@Catch()
export class ErrorFilter implements ExceptionFilter {
  constructor(private readonly logger?: ErrorLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp()
    const response = http.getResponse<FastifyReply>()
    const request = http.getRequest<FastifyRequest>()
    const logger = this.logger ?? request.log
    const statusCode = this.getStatusCode(exception)

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const error = this.toError(exception)
      logger.error(
        {
          err: error,
          requestId: request.id,
          method: request.method,
          path: request.url,
          statusCode,
        },
        '请求处理发生未预期异常',
      )
    } else {
      const payload = this.getPublicPayload(exception, statusCode)
      logger.warn(
        {
          requestId: request.id,
          errorCode: payload.code,
          method: request.method,
          path: request.url,
          statusCode,
        },
        payload.message,
      )
    }

    if (response.sent) {
      return
    }

    const payload = this.getPublicPayload(exception, statusCode)
    response.status(statusCode).send({
      error: payload,
      requestId: request.id,
      timestamp: new Date().toISOString(),
      path: request.url,
    })
  }

  private getStatusCode(exception: unknown): number {
    if (exception instanceof AppError) {
      return exception.statusCode
    }
    if (exception instanceof HttpException) {
      return exception.getStatus()
    }
    return HttpStatus.INTERNAL_SERVER_ERROR
  }

  private getPublicPayload(exception: unknown, statusCode: number): ErrorPayload {
    // 5xx 默认不向客户端暴露内部细节;例外:显式携带业务错误码的 HttpException
    // (如 AI 降级 503/AI_OUTPUT_INVALID),其消息在抛出时已脱敏。
    const explicitCode = this.getExplicitBusinessCode(exception)
    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR && explicitCode === null) {
      return {
        code: 'INTERNAL_SERVER_ERROR',
        message: '服务器内部错误',
        details: null,
      }
    }

    if (exception instanceof AppError) {
      return {
        code: exception.code,
        message: exception.message,
        details: null,
      }
    }

    if (explicitCode !== null) {
      return explicitCode
    }

    if (exception instanceof HttpException) {
      const raw = exception.getResponse()
      if (typeof raw === 'string') {
        return { code: 'HTTP_ERROR', message: raw, details: null }
      }
      if (this.isObject(raw)) {
        return {
          code: typeof raw.code === 'string' ? raw.code : 'HTTP_ERROR',
          message: this.getHttpMessage(raw.message, exception.message),
          details: 'details' in raw ? raw.details : null,
        }
      }
    }

    return {
      code: 'HTTP_ERROR',
      message: exception instanceof Error ? exception.message : 'HTTP Error',
      details: null,
    }
  }

  /** 仅当 HttpException 的响应体显式携带字符串 code 时返回完整负载。 */
  private getExplicitBusinessCode(exception: unknown): ErrorPayload | null {
    if (!(exception instanceof HttpException)) {
      return null
    }
    const raw = exception.getResponse()
    if (this.isObject(raw) && typeof raw.code === 'string') {
      return {
        code: raw.code,
        message: this.getHttpMessage(raw.message, exception.message),
        details: 'details' in raw ? raw.details : null,
      }
    }
    return null
  }

  private getHttpMessage(message: unknown, fallback: string): string {
    if (typeof message === 'string') {
      return message
    }
    if (Array.isArray(message)) {
      return message.map(String).join(', ')
    }
    return fallback
  }

  private toError(exception: unknown): Error {
    if (exception instanceof Error) {
      return exception
    }
    if (typeof exception === 'string') {
      return new Error(exception)
    }
    try {
      return new Error(JSON.stringify(exception))
    } catch {
      return new Error(String(exception))
    }
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
  }
}
