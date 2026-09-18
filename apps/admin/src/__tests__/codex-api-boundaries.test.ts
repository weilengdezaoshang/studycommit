import { afterEach, expect, it, vi } from 'vitest'
import { AdminClient } from '../services/api-client'

afterEach(() => vi.unstubAllGlobals())

it('401 的 JSON 为 null 时仍清理过期会话并保留状态码', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('null', { status: 401 })),
  )
  const onUnauthorized = vi.fn()
  const client = new AdminClient({ baseUrl: '', getToken: () => 'test-only', onUnauthorized })
  await expect(client.get('/test')).rejects.toMatchObject({ status: 401 })
  expect(onUnauthorized).toHaveBeenCalledOnce()
})
