import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { createProviderFetch } from './provider-http'

const servers: Array<ReturnType<typeof createServer>> = []

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()))
        }),
    ),
  )
})

function listen(
  handler: Parameters<typeof createServer>[1],
): Promise<{ port: number; origin: string }> {
  const server = createServer(handler)
  servers.push(server)
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port
      resolve({ port, origin: `http://127.0.0.1:${port}` })
    })
    server.on('error', reject)
  })
}

describe('createProviderFetch', () => {
  it('禁止自动跟随重定向到其他地址', async () => {
    const target = await listen((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end('{}')
    })
    const source = await listen((_req, res) => {
      res.writeHead(302, { location: `${target.origin}/v1/chat/completions` })
      res.end()
    })
    const fetchImpl = createProviderFetch([source.origin])
    await expect(
      fetchImpl(`${source.origin}/v1/chat/completions`, { method: 'POST' }),
    ).rejects.toThrow()
  })

  it('未声明为可信时代理回环地址不可连接', async () => {
    const local = await listen((_req, res) => {
      res.writeHead(200)
      res.end('{}')
    })
    const fetchImpl = createProviderFetch([])
    await expect(fetchImpl(`${local.origin}/v1`, { method: 'POST' })).rejects.toThrow()
  })

  it('服务端显式配置的可信代理允许本机 HTTP', async () => {
    const local = await listen((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end('{"ok":true}')
    })
    const fetchImpl = createProviderFetch([local.origin])
    const response = await fetchImpl(`${local.origin}/v1`, { method: 'POST' })
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('{"ok":true}')
  })
})
