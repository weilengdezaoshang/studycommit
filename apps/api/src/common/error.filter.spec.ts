import {
  BadRequestException,
  HttpException,
  NotFoundException,
  type ArgumentsHost,
} from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import { AppError } from './app.error'
import { ErrorFilter, type ErrorLogger } from './error.filter'

function createHttpContext(options?: { sent?: boolean; requestId?: string }) {
  const send = vi.fn()
  const status = vi.fn(() => ({ send }))
  const request = {
    id: options?.requestId ?? 'req-test-001',
    method: 'POST',
    url: '/api/study-sessions',
  }
  const response = { sent: options?.sent ?? false, status }
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as ArgumentsHost

  return { host, request, response, send, status }
}

function createLogger(): ErrorLogger {
  return { warn: vi.fn(), error: vi.fn() }
}

describe('ErrorFilter', () => {
  describe('可预期异常', () => {
    it('业务异常返回稳定协议，并记录 warn 级别上下文', () => {
      const logger = createLogger()
      const filter = new ErrorFilter(logger)
      const { host, send, status } = createHttpContext()
      const error = new AppError('ACTIVE_STUDY_SESSION_EXISTS', 409, '当前已有进行中的学习会话')

      filter.catch(error, host)

      expect(status).toHaveBeenCalledWith(409)
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: {
            code: 'ACTIVE_STUDY_SESSION_EXISTS',
            message: '当前已有进行中的学习会话',
            details: null,
          },
          requestId: 'req-test-001',
          path: '/api/study-sessions',
        }),
      )
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'req-test-001',
          errorCode: 'ACTIVE_STUDY_SESSION_EXISTS',
          method: 'POST',
          path: '/api/study-sessions',
          statusCode: 409,
        }),
        '当前已有进行中的学习会话',
      )
      expect(logger.error).not.toHaveBeenCalled()
    })

    it('保留校验异常的 details，但不返回堆栈', () => {
      const logger = createLogger()
      const filter = new ErrorFilter(logger)
      const { host, send } = createHttpContext()
      const details = { fieldErrors: { title: ['不能为空'] } }

      filter.catch(
        new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: '请求参数不合法',
          details,
        }),
        host,
      )

      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: { code: 'VALIDATION_ERROR', message: '请求参数不合法', details },
        }),
      )
      expect(JSON.stringify(send.mock.calls[0]?.[0])).not.toContain('stack')
    })

    it.each([
      [new NotFoundException(), 404, 'HTTP_ERROR', 'Not Found'],
      [new HttpException('请求被拒绝', 403), 403, 'HTTP_ERROR', '请求被拒绝'],
    ])('兼容 Nest 标准 HTTP 异常 %#', (error, expectedStatus, expectedCode, expectedMessage) => {
      const logger = createLogger()
      const filter = new ErrorFilter(logger)
      const { host, send, status } = createHttpContext()

      filter.catch(error, host)

      expect(status).toHaveBeenCalledWith(expectedStatus)
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: expectedCode, message: expectedMessage }),
        }),
      )
      expect(logger.warn).toHaveBeenCalledOnce()
      expect(logger.error).not.toHaveBeenCalled()
    })
  })

  describe('未预期异常', () => {
    it('记录原始 Error 对象、堆栈和完整请求上下文', () => {
      const logger = createLogger()
      const filter = new ErrorFilter(logger)
      const { host } = createHttpContext()
      const error = new TypeError('测试空引用异常')

      filter.catch(error, host)

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: error,
          requestId: 'req-test-001',
          method: 'POST',
          path: '/api/study-sessions',
          statusCode: 500,
        }),
        '请求处理发生未预期异常',
      )
      expect(error.stack).toContain('TypeError: 测试空引用异常')
    })

    it('将字符串抛出值安全归一化为 Error', () => {
      const logger = createLogger()
      const filter = new ErrorFilter(logger)
      const { host } = createHttpContext()

      filter.catch('string error', host)

      const logged = vi.mocked(logger.error).mock.calls[0]?.[0] as { err: Error }
      expect(logged.err).toBeInstanceOf(Error)
      expect(logged.err.message).toBe('string error')
    })

    it('非 Error 对象无法 JSON 序列化时仍能生成 Error', () => {
      const logger = createLogger()
      const filter = new ErrorFilter(logger)
      const { host } = createHttpContext()
      const circular: { self?: unknown } = {}
      circular.self = circular

      filter.catch(circular, host)

      const logged = vi.mocked(logger.error).mock.calls[0]?.[0] as { err: Error }
      expect(logged.err).toBeInstanceOf(Error)
    })

    it('保留底层 cause 链供日志序列化', () => {
      const logger = createLogger()
      const filter = new ErrorFilter(logger)
      const { host } = createHttpContext()
      const cause = new Error('connection timeout')
      const error = new Error('创建学习会话失败', { cause })

      filter.catch(error, host)

      const logged = vi.mocked(logger.error).mock.calls[0]?.[0] as { err: Error }
      expect(logged.err).toBe(error)
      expect(logged.err.cause).toBe(cause)
    })

    it('对客户端隐藏内部消息、堆栈和敏感数据', () => {
      const logger = createLogger()
      const filter = new ErrorFilter(logger)
      const { host, send, status } = createHttpContext()
      const error = new Error('DATABASE_URL=postgres://admin:secret@db/studycommit')

      filter.catch(error, host)

      expect(status).toHaveBeenCalledWith(500)
      const serialized = JSON.stringify(send.mock.calls[0]?.[0])
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: '服务器内部错误',
            details: null,
          },
          requestId: 'req-test-001',
        }),
      )
      expect(serialized).not.toContain('postgres://')
      expect(serialized).not.toContain('stack')
    })

    it('即使是带业务类型的 5xx 也不向客户端暴露内部消息', () => {
      const logger = createLogger()
      const filter = new ErrorFilter(logger)
      const { host, send } = createHttpContext()

      filter.catch(
        new AppError(
          'DATABASE_OPERATION_FAILED',
          500,
          'PostgreSQL password=secret connection refused',
        ),
        host,
      )

      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: '服务器内部错误',
            details: null,
          },
        }),
      )
      expect(logger.error).toHaveBeenCalledOnce()
    })
  })

  describe('边界与响应安全', () => {
    it('返回的 requestId 与日志中完全一致', () => {
      const logger = createLogger()
      const filter = new ErrorFilter(logger)
      const { host, send } = createHttpContext({ requestId: 'req-correlation-999' })

      filter.catch(new Error('boom'), host)

      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: 'req-correlation-999' }),
      )
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'req-correlation-999',
        }),
        expect.any(String),
      )
    })

    it('响应已发送时仍记录异常，但不二次发送', () => {
      const logger = createLogger()
      const filter = new ErrorFilter(logger)
      const { host, send, status } = createHttpContext({ sent: true })

      filter.catch(new Error('stream failed'), host)

      expect(logger.error).toHaveBeenCalledOnce()
      expect(status).not.toHaveBeenCalled()
      expect(send).not.toHaveBeenCalled()
    })
  })
})
