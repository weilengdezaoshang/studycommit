import { describe, expect, it } from 'vitest'
import { createLoggingConfig } from './logging.config'

describe('createLoggingConfig', () => {
  it('开发环境输出可读的 debug 日志', () => {
    const config = createLoggingConfig('development')

    expect(config.pinoHttp).toEqual(expect.objectContaining({
      level: 'debug',
      transport: expect.objectContaining({ target: 'pino-pretty' })
    }))
  })

  it('生产环境输出 JSON info 日志，不加载 pretty transport', () => {
    const config = createLoggingConfig('production')

    expect(config.pinoHttp).toEqual(expect.objectContaining({ level: 'info' }))
    expect(config.pinoHttp).not.toHaveProperty('transport')
  })

  it('测试环境关闭非必要日志', () => {
    const config = createLoggingConfig('test')

    expect(config.pinoHttp).toEqual(expect.objectContaining({ level: 'silent' }))
    expect(config.pinoHttp).not.toHaveProperty('transport')
  })

  it('为每条日志增加服务名和运行环境', () => {
    const config = createLoggingConfig('production')

    expect(config.pinoHttp).toEqual(expect.objectContaining({
      base: {
        service: 'studycommit-api',
        environment: 'production'
      }
    }))
  })

  it('配置请求头、请求体和响应头的敏感字段脱敏', () => {
    const config = createLoggingConfig('production')
    const redact = config.pinoHttp.redact as { paths: string[]; censor: string }

    expect(redact.censor).toBe('[REDACTED]')
    expect(redact.paths).toEqual(expect.arrayContaining([
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.token',
      'req.body.accessToken',
      'req.body.refreshToken',
      'res.headers["set-cookie"]'
    ]))
  })
})
