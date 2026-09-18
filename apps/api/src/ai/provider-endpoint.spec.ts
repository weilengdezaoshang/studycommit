import { describe, expect, it, vi } from 'vitest'
import { assertProviderBaseUrl, parseTrustedBaseUrls } from './provider-endpoint'

describe('provider-endpoint', () => {
  it('接受公网 HTTPS 地址', async () => {
    const lookup = vi.fn().mockResolvedValue([{ address: '1.1.1.1' }])
    await expect(assertProviderBaseUrl('https://api.openai.com/v1', [], lookup)).resolves.toBe(
      'https://api.openai.com/v1',
    )
  })

  it('拒绝云元数据与内网地址', async () => {
    await expect(assertProviderBaseUrl('http://169.254.169.254/latest', [])).rejects.toMatchObject({
      response: { code: 'AI_PROVIDER_URL_UNSAFE' },
    })
    await expect(assertProviderBaseUrl('https://127.0.0.1/v1', [])).rejects.toMatchObject({
      response: { code: 'AI_PROVIDER_URL_UNSAFE' },
    })
    await expect(assertProviderBaseUrl('https://10.0.0.8/v1', [])).rejects.toMatchObject({
      response: { code: 'AI_PROVIDER_URL_UNSAFE' },
    })
    await expect(
      assertProviderBaseUrl('https://metadata.google.internal/computeMetadata/v1', []),
    ).rejects.toMatchObject({ response: { code: 'AI_PROVIDER_URL_UNSAFE' } })
  })

  it('拒绝解析到内网的公网主机名', async () => {
    const lookup = vi.fn().mockResolvedValue([{ address: '10.1.2.3' }])
    await expect(
      assertProviderBaseUrl('https://evil.example/v1', [], lookup),
    ).rejects.toMatchObject({ response: { code: 'AI_PROVIDER_URL_UNSAFE' } })
  })

  it('拒绝地址中的凭据或查询串', async () => {
    await expect(
      assertProviderBaseUrl('https://user:pass@api.openai.com/v1', []),
    ).rejects.toMatchObject({ response: { code: 'AI_PROVIDER_URL_UNSAFE' } })
  })

  it('仅允许服务端显式配置的本地代理', async () => {
    const trusted = parseTrustedBaseUrls('http://127.0.0.1:11434')
    await expect(assertProviderBaseUrl('http://127.0.0.1:11434/v1', trusted)).resolves.toBe(
      'http://127.0.0.1:11434/v1',
    )
    await expect(assertProviderBaseUrl('http://127.0.0.1:11435/v1', trusted)).rejects.toMatchObject(
      {
        response: { code: 'AI_PROVIDER_URL_UNSAFE' },
      },
    )
  })
})
