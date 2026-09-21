import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { describe, it, expect, vi } from 'vitest'
import { createBackendHandler } from './backend/handler'
import { createInternalApiClient } from './backend/api-client'
import { createRouter } from './backend/router'

function loadEntry(path, modules) {
  const exports = {}
  vm.runInNewContext(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    exports,
    require: (name) => modules[name],
    process: { env: {} },
    console,
  })
  return exports
}

describe('云函数生产入口接线', () => {
  it('OCR 入口注入真实云文件下载和删除能力', async () => {
    const cloud = {
      init: vi.fn(),
      database: () => ({}),
      getWXContext: () => ({}),
      downloadFile: vi.fn().mockResolvedValue({ fileContent: Buffer.from('image') }),
      deleteFile: vi.fn().mockResolvedValue({}),
    }
    let deps
    loadEntry('./ocr/index.js', {
      'wx-server-sdk': cloud,
      'tencentcloud-sdk-nodejs-ocr': {},
      './handler': {
        createOcrHandler: (value) => {
          deps = value
          return () => {}
        },
      },
    })
    await deps.downloadFile({ fileID: 'file' })
    await deps.deleteFile({ fileList: ['file'] })
    expect(cloud.downloadFile).toHaveBeenCalledWith({ fileID: 'file' })
    expect(cloud.deleteFile).toHaveBeenCalledWith({ fileList: ['file'] })
  })
  it('内部客户端原样上传二进制并拒绝非成功状态', async () => {
    const sendRequest = vi.fn().mockResolvedValue({ status: 200 })
    const api = createInternalApiClient({ env: {}, log: console, sendRequest })
    const body = Buffer.from([0, 255, 1])
    await api.sendRaw({ method: 'PUT', url: 'https://storage.test/file', headers: {}, body })
    expect(sendRequest.mock.calls[0][0].body).toBe(body)
    expect(sendRequest.mock.calls[0][0].timeoutMs).toBeGreaterThan(0)
    sendRequest.mockResolvedValue({ status: 403 })
    await expect(
      api.sendRaw({ method: 'PUT', url: 'https://storage.test/file', body }),
    ).rejects.toMatchObject({ code: 'PROVIDER_FAILED' })
  })
  it('附件访问路由要求身份并转发正确路径', async () => {
    const route = createRouter().resolve('uploads.access')
    expect(route.auth).toBe('identity')
    const forward = vi.fn().mockResolvedValue({ url: 'signed' })
    await route.fn({ forward, payload: { assetId: 'asset-1' } })
    expect(forward).toHaveBeenCalledWith('GET', '/paper-assets/asset-1/access')
  })
})

it('附件访问经身份交换后使用用户令牌转发', async () => {
  const apiClient = {
    exchangeIdentity: vi.fn().mockResolvedValue({
      user: { id: 'user' },
      tokens: { accessToken: 'token', expiresAt: new Date(Date.now() + 3600000).toISOString() },
    }),
    forward: vi.fn().mockResolvedValue({ url: 'signed-url' }),
  }
  const handler = createBackendHandler({
    getWXContext: () => ({ OPENID: 'openid' }),
    apiClient,
    cloud: {},
    env: {},
    log: { info() {}, error() {} },
  })
  const response = await handler({
    version: 1,
    requestId: 'request',
    operation: 'uploads.access',
    payload: { assetId: 'asset' },
  })
  expect(response).toMatchObject({ ok: true, data: { url: 'signed-url' } })
  expect(apiClient.forward).toHaveBeenCalledWith(
    expect.objectContaining({ path: '/paper-assets/asset/access', token: 'token' }),
  )
})
