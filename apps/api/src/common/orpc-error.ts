import { HttpException, Logger } from '@nestjs/common'
import { ORPCError } from '@orpc/nest'

const logger = new Logger('OrpcError')

/** 把业务 HttpException 的 code/message/details 原样映射为 ORPCError,未知错误统一按 500 处理并记日志。 */
export function toOrpcError(error: unknown): ORPCError<string, unknown> {
  if (error instanceof ORPCError) {
    return error
  }
  if (error instanceof HttpException) {
    const raw = error.getResponse()
    const response =
      typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : null
    const code =
      response && typeof response.code === 'string'
        ? response.code
        : error.getStatus() >= 500
          ? 'INTERNAL_SERVER_ERROR'
          : 'BAD_REQUEST'
    const message =
      response && typeof response.message === 'string' ? response.message : error.message
    const data = response && 'details' in response ? response.details : undefined

    return new ORPCError(code, {
      status: error.getStatus() >= 500 ? 500 : error.getStatus(),
      message,
      data,
    })
  }
  logger.error(error instanceof Error ? (error.stack ?? error.message) : String(error))
  return new ORPCError('INTERNAL_SERVER_ERROR', {
    status: 500,
    message: 'Internal server error',
  })
}

/** 统一捕获 oRPC handler 内外的同步与异步错误。 */
export function handleOrpc<T>(operation: () => T | Promise<T>): Promise<T> {
  return Promise.resolve()
    .then(operation)
    .catch((error: unknown) => {
      throw toOrpcError(error)
    })
}
