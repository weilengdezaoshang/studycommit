import { describe, expect, it, vi } from 'vitest'
import {
  assertConnectedIp,
  assertProviderBaseUrl,
  ipUnsafe,
  parseTrustedBaseUrls,
  pickSafeConnectAddress,
} from './provider-endpoint'

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

  it('拒绝 IPv6 回环、链路本地、唯一本地与云元数据地址', () => {
    expect(ipUnsafe('::1')).toBe(true)
    expect(ipUnsafe('fe80::1')).toBe(true)
    expect(ipUnsafe('fc00::1')).toBe(true)
    expect(ipUnsafe('fd00:ec2::254')).toBe(true)
    expect(ipUnsafe('2001:4860:4860::8888')).toBe(false)
    expect(() => assertConnectedIp('api.example', '169.254.169.254', [])).toThrow()
    expect(() => assertConnectedIp('api.example', '::ffff:10.0.0.1', [])).toThrow()
    expect(() =>
      assertConnectedIp('127.0.0.1', '127.0.0.1', ['http://127.0.0.1:11434']),
    ).not.toThrow()
  })

  it('连接时 DNS 变为内网地址则拒绝', () => {
    expect(() =>
      pickSafeConnectAddress('api.openai.com', [{ address: '169.254.169.254', family: 4 }], []),
    ).toThrow()
    expect(
      pickSafeConnectAddress('api.openai.com', [{ address: '1.1.1.1', family: 4 }], []).address,
    ).toBe('1.1.1.1')
  })

  it('实际连接 IP 变成云元数据或私网时拒绝,即使主机名看起来安全', () => {
    expect(() => assertConnectedIp('api.openai.com', '169.254.169.254', [])).toThrow()
    expect(() => assertConnectedIp('api.openai.com', '10.0.0.8', [])).toThrow()
    expect(() => assertConnectedIp('api.openai.com', '192.168.1.1', [])).toThrow()
    expect(() => assertConnectedIp('api.openai.com', '::ffff:127.0.0.1', [])).toThrow()
    expect(() => assertConnectedIp('api.openai.com', 'fd00:ec2::254', [])).toThrow()
    expect(() => assertConnectedIp('api.openai.com', '1.1.1.1', [])).not.toThrow()
  })

  it('IPv6 回环仅在服务端显式配置为可信代理时允许', () => {
    expect(() => assertConnectedIp('::1', '::1', [])).toThrow()
    expect(() => assertConnectedIp('::1', '::1', ['http://[::1]:11434'])).not.toThrow()
    expect(() => assertConnectedIp('fe80::1', 'fe80::1', [])).toThrow()
    expect(() => assertConnectedIp('fe80::1', 'fe80::1', ['http://[fe80::1]/'])).not.toThrow()
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
