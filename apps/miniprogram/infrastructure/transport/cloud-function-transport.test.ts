import { describe, expect, it, vi } from 'vitest'
import { ServiceError } from '../../shared/service-runtime/index'
import {
  createCloudFunctionTransport,
  type CloudCallFunctionImpl,
} from './cloud-function-transport'

function success(result: unknown) {
  return { result: { ok: true, requestId: 'req-1', data: result } }
}

function createPendingCall() {
  let reject!: (error: unknown) => void
  const promise = new Promise<never>((_, rejectFn) => {
    reject = rejectFn
  })
  return { promise, reject }
}

describe('CloudFunctionTransport', () => {
  it('云函数成功响应返回 data 字段', async () => {
    const callFunction: CloudCallFunctionImpl = vi.fn(async () => success({ value: 42 }))
    const transport = createCloudFunctionTransport({
      createRequestId: () => 'req-1',
      callFunction,
      cloudAvailable: () => true,
    })
    await expect(transport.call('papers.list', { limit: 10 })).resolves.toEqual({ value: 42 })
  })

  it('请求信封携带协议版本、operation、requestId 与幂等键', async () => {
    const callFunction: CloudCallFunctionImpl = vi.fn(async () => success(null))
    const transport = createCloudFunctionTransport({
      createRequestId: () => 'req-9',
      callFunction,
      cloudAvailable: () => true,
    })
    await transport.call('papers.create', { content: '内容' }, { idempotencyKey: 'idem-1' })
    expect(callFunction).toHaveBeenCalledWith({
      name: 'backend',
      data: {
        version: 1,
        operation: 'papers.create',
        requestId: 'req-9',
        idempotencyKey: 'idem-1',
        payload: { content: '内容' },
      },
    })
  })

  it('业务失败响应转换为统一 ServiceError', async () => {
    const callFunction: CloudCallFunctionImpl = vi.fn(async () => ({
      result: {
        ok: false,
        requestId: 'req-1',
        error: { code: 'RATE_LIMITED', message: '今日次数用完', retryable: true },
      },
    }))
    const transport = createCloudFunctionTransport({
      createRequestId: () => 'req-1',
      callFunction,
      cloudAvailable: () => true,
    })
    const error = await transport.call('papers.create', {}).catch((caught) => caught)
    expect(error).toBeInstanceOf(ServiceError)
    expect(error).toMatchObject({ code: 'RATE_LIMITED', retryable: true })
  })

  it('云函数调用失败归一为网络错误', async () => {
    const callFunction: CloudCallFunctionImpl = vi.fn(async () => {
      throw new Error('cloud.callFunction:fail')
    })
    const transport = createCloudFunctionTransport({
      createRequestId: () => 'req-1',
      callFunction,
      cloudAvailable: () => true,
    })
    await expect(transport.call('papers.list', {})).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    })
  })

  it('调用超过限时返回超时错误', async () => {
    const pending = createPendingCall()
    const callFunction: CloudCallFunctionImpl = vi.fn(() => pending.promise)
    const transport = createCloudFunctionTransport({
      createRequestId: () => 'req-1',
      callFunction,
      cloudAvailable: () => true,
    })
    await expect(transport.call('papers.list', {}, { timeoutMs: 20 })).rejects.toMatchObject({
      code: 'TIMEOUT',
    })
    pending.reject(new Error('late'))
    await expect(pending.promise).rejects.toThrow()
  })

  it('非法响应结构判定为未知错误而不透出内容', async () => {
    const callFunction: CloudCallFunctionImpl = vi.fn(async () => ({
      result: { hello: 'world' },
    }))
    const transport = createCloudFunctionTransport({
      createRequestId: () => 'req-1',
      callFunction,
      cloudAvailable: () => true,
    })
    await expect(transport.call('papers.list', {})).rejects.toMatchObject({ code: 'UNKNOWN' })
  })

  it('取消请求时立即放弃等待', async () => {
    const pending = createPendingCall()
    const controller = new AbortController()
    const callFunction: CloudCallFunctionImpl = vi.fn(() => pending.promise)
    const transport = createCloudFunctionTransport({
      createRequestId: () => 'req-1',
      callFunction,
      cloudAvailable: () => true,
    })
    const pendingCall = transport.call('papers.list', {}, { signal: controller.signal })
    controller.abort()
    await expect(pendingCall).rejects.toThrow('请求已取消')
    pending.reject(new Error('late'))
    await expect(pending.promise).rejects.toThrow()
  })

  it('未开通云能力时明确报功能关闭', async () => {
    const transport = createCloudFunctionTransport({
      createRequestId: () => 'req-1',
      cloudAvailable: () => false,
    })
    await expect(transport.call('papers.list', {})).rejects.toMatchObject({
      code: 'SERVICE_DISABLED',
    })
  })
})
