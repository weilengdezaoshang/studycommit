import { describe, expect, it, vi } from 'vitest'
import { createMonitor, type MonitorRecord } from './index'

function createReporter() {
  const report = vi.fn()
  return { report, reporter: { report } }
}

describe('monitor', () => {
  it('creates structured log records with platform context', () => {
    const { report, reporter } = createReporter()
    const monitor = createMonitor({
      platform: 'miniprogram',
      appVersion: '0.1.0',
      getContext: () => ({ page: 'pages/home/home' }),
      reporters: [reporter],
      now: () => 1700000000000,
    })

    monitor.log.info('小程序启动')

    expect(report).toHaveBeenCalledWith({
      schemaVersion: 1,
      type: 'log',
      level: 'info',
      message: '小程序启动',
      context: {
        platform: 'miniprogram',
        appVersion: '0.1.0',
        page: 'pages/home/home',
      },
      timestamp: 1700000000000,
    })
  })

  it('keeps tracking events separate from logs', () => {
    const { report, reporter } = createReporter()
    const monitor = createMonitor({ platform: 'miniprogram', reporters: [reporter] })

    monitor.track('note_save_success', { isQuestion: true })

    expect(report).toHaveBeenCalledWith(
      expect.objectContaining<Partial<MonitorRecord>>({
        type: 'track',
        name: 'note_save_success',
        properties: { isQuestion: true },
      }),
    )
    expect(report.mock.calls[0]?.[0]).not.toHaveProperty('level')
  })

  it('normalizes Error objects without losing message and stack', () => {
    const { report, reporter } = createReporter()
    const monitor = createMonitor({ platform: 'miniprogram', reporters: [reporter] })
    const error = new Error('保存失败')

    monitor.captureError(error, { action: 'note_save' })

    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        error: expect.objectContaining({
          name: 'Error',
          message: '保存失败',
          stack: error.stack,
        }),
        context: expect.objectContaining({ action: 'note_save' }),
      }),
    )
  })

  it('redacts sensitive values in error messages and stacks', () => {
    const { report, reporter } = createReporter()
    const monitor = createMonitor({ platform: 'miniprogram', reporters: [reporter] })
    const error = new Error('request failed token=secret-token')
    error.stack = 'Error: password=secret-password'

    monitor.captureError(error)

    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: 'request failed token=[REDACTED]',
          stack: 'Error: password=[REDACTED]',
        }),
      }),
    )
  })

  it('redacts sensitive values recursively', () => {
    const { report, reporter } = createReporter()
    const monitor = createMonitor({ platform: 'miniprogram', reporters: [reporter] })

    monitor.track('user_action', {
      token: 'secret-token',
      nested: { password: 'secret-password', safe: 'kept' },
      list: [{ authorization: 'secret-auth' }],
    })

    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: {
          token: '[REDACTED]',
          nested: { password: '[REDACTED]', safe: 'kept' },
          list: [{ authorization: '[REDACTED]' }],
        },
      }),
    )
  })

  it('does not let a reporter failure break the business call', async () => {
    const failingReporter = {
      report: vi.fn(() => Promise.reject(new Error('监控平台不可用'))),
    }
    const monitor = createMonitor({ platform: 'miniprogram', reporters: [failingReporter] })

    expect(() => monitor.track('note_save_click')).not.toThrow()
    await Promise.resolve()
    expect(failingReporter.report).toHaveBeenCalledOnce()
  })

  it('continues reporting when one reporter fails', () => {
    const failed = {
      report: vi.fn(() => {
        throw new Error('failed')
      }),
    }
    const { report, reporter } = createReporter()
    const monitor = createMonitor({ platform: 'miniprogram', reporters: [failed, reporter] })

    expect(() => monitor.log.error('保存失败')).not.toThrow()
    expect(report).toHaveBeenCalledOnce()
  })

  it('keeps working when platform context collection fails', () => {
    const { report, reporter } = createReporter()
    const monitor = createMonitor({
      platform: 'miniprogram',
      getContext: () => {
        throw new Error('平台 API 不可用')
      },
      reporters: [reporter],
    })

    expect(() => monitor.log.info('启动')).not.toThrow()
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({ contextError: '读取平台上下文失败' }),
      }),
    )
  })
})
