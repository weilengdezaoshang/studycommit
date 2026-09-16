import { describe, expect, it } from 'vitest'
import { ServiceError } from '../../shared/service-runtime/index'
import { createMiniprogramTransport } from './create-transport'
import { MINIPROGRAM_OPERATIONS } from '../services/operations'

function createStubs() {
  const cloudCalls: string[] = []
  const httpCalls: string[] = []
  return { cloudCalls, httpCalls }
}

describe('createMiniprogramTransport 回退策略', () => {
  it('读请求云函数故障且配置允许时回退 HTTP', async () => {
    const { cloudCalls, httpCalls } = createStubs()
    const transport = createMiniprogramTransport({
      mode: 'cloud-function',
      allowHttpFallback: true,
      registry: MINIPROGRAM_OPERATIONS,
      createRequestId: () => 'req-1',
      cloudAvailable: () => true,
      cloudCallFunction: (async () => {
        cloudCalls.push('cloud')
        throw new ServiceError({ code: 'NETWORK_ERROR', message: '网络不可用', retryable: true })
      }) as never,
      httpRequest: (async (_request: unknown, _access: unknown) => {
        httpCalls.push('http')
        return { items: [] } as never
      }) as never,
    })
    await expect(transport.call('papers.list', {})).resolves.toEqual({ items: [] })
    expect(cloudCalls).toEqual(['cloud'])
    expect(httpCalls).toEqual(['http'])
  })

  it('写请求失败时不自动重复提交也不回退', async () => {
    const { cloudCalls, httpCalls } = createStubs()
    const transport = createMiniprogramTransport({
      mode: 'cloud-function',
      allowHttpFallback: true,
      registry: MINIPROGRAM_OPERATIONS,
      createRequestId: () => 'req-1',
      cloudAvailable: () => true,
      cloudCallFunction: (async () => {
        cloudCalls.push('cloud')
        throw new ServiceError({ code: 'NETWORK_ERROR', message: '网络不可用', retryable: true })
      }) as never,
      httpRequest: (async () => {
        httpCalls.push('http')
        return {} as never
      }) as never,
    })
    await expect(
      transport.call('papers.create', { content: 'x' }, { idempotencyKey: 'idem-1' }),
    ).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
    expect(cloudCalls).toEqual(['cloud'])
    expect(httpCalls).toEqual([])
  })

  it('未开启回退配置时读请求失败直接抛出', async () => {
    const { httpCalls } = createStubs()
    const transport = createMiniprogramTransport({
      mode: 'cloud-function',
      registry: MINIPROGRAM_OPERATIONS,
      createRequestId: () => 'req-1',
      cloudAvailable: () => true,
      cloudCallFunction: (async () => {
        throw new ServiceError({ code: 'TIMEOUT', message: '超时', retryable: true })
      }) as never,
      httpRequest: (async () => {
        httpCalls.push('http')
        return {} as never
      }) as never,
    })
    await expect(transport.call('papers.list', {})).rejects.toMatchObject({ code: 'TIMEOUT' })
    expect(httpCalls).toEqual([])
  })

  it('业务失败（限流等）不属于回退资格', async () => {
    const { httpCalls } = createStubs()
    const transport = createMiniprogramTransport({
      mode: 'cloud-function',
      allowHttpFallback: true,
      registry: MINIPROGRAM_OPERATIONS,
      createRequestId: () => 'req-1',
      cloudAvailable: () => true,
      cloudCallFunction: (async () => ({
        result: {
          ok: false,
          requestId: 'req-1',
          error: { code: 'RATE_LIMITED', message: '受限', retryable: false },
        },
      })) as never,
      httpRequest: (async () => {
        httpCalls.push('http')
        return {} as never
      }) as never,
    })
    await expect(transport.call('papers.list', {})).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    })
    expect(httpCalls).toEqual([])
  })

  it('HTTP 模式直接走 HTTP 且不经过云函数', async () => {
    const { cloudCalls, httpCalls } = createStubs()
    const transport = createMiniprogramTransport({
      mode: 'http',
      allowHttpFallback: true,
      registry: MINIPROGRAM_OPERATIONS,
      createRequestId: () => 'req-1',
      cloudCallFunction: (async () => {
        cloudCalls.push('cloud')
        return {} as never
      }) as never,
      httpRequest: (async () => {
        httpCalls.push('http')
        return { items: [] } as never
      }) as never,
    })
    await expect(transport.call('papers.list', {})).resolves.toEqual({ items: [] })
    expect(cloudCalls).toEqual([])
    expect(httpCalls).toEqual(['http'])
  })
})
