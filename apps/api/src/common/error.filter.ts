import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common'
import type { FastifyReply, FastifyRequest } from 'fastify'
@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<FastifyReply>()
    const request = host.switchToHttp().getRequest<FastifyRequest>()
    const status = error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR
    const raw = error instanceof HttpException ? error.getResponse() : null
    const payload = typeof raw === 'object' && raw && 'code' in raw ? raw as { code: string; message: string; details?: unknown } : {
      code: status === 500 ? 'INTERNAL_ERROR' : 'HTTP_ERROR',
      message: typeof raw === 'object' && raw && 'message' in raw ? String(raw.message) : '服务器内部错误', details: null
    }
    response.status(status).send({ error: { code: payload.code, message: payload.message, details: payload.details ?? null }, requestId: request.id, timestamp: new Date().toISOString(), path: request.url })
  }
}
