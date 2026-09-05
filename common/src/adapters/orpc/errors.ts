import { ORPCError } from '@orpc/client'
import { createHttpError, httpErrorFromStatus, HttpError } from '../../http'

/** 把 oRPC 客户端抛出的业务错误转换为各端统一的 HttpError。 */
export function orpcToHttpError(error: unknown): unknown {
  if (error instanceof HttpError) {
    return error
  }
  if (error instanceof ORPCError) {
    return createHttpError({
      code: httpErrorFromStatus(error.status),
      message: error.message,
      status: error.status,
      backendCode: error.code,
      details: error.data ?? null,
    })
  }
  return error
}

/** 统一执行 oRPC 调用并完成错误转换。 */
export async function callOrpc<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw orpcToHttpError(error)
  }
}
