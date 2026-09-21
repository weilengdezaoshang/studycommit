// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('桌面图片来源策略', () => {
  it('仅允许同源内嵌图片及明确的本机存储地址且保留脚本限制', () => {
    const html = readFileSync(new URL('../../renderer/index.html', import.meta.url), 'utf8')
    const policy = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1]
    const images = policy?.match(/img-src ([^;]+)/)?.[1].split(' ')
    expect(images).toEqual([
      "'self'",
      'data:',
      'http://127.0.0.1:9000',
      'http://localhost:9000',
      'http://127.0.0.1:3000',
      'http://localhost:3000',
    ])
    expect(policy).toContain("script-src 'self';")
    expect(policy).toContain("object-src 'none';")
  })
})
