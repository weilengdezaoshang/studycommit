import { describe, expect, it, vi } from 'vitest'
import { createStudySessionsService } from './study-sessions-service'
import type { MiniprogramTransport } from '../transport/transport.types'

const session = {
  id: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  topicId: null,
  paperId: null,
  source: 'manual_topic',
  goal: null,
  status: 'running',
  startedAt: '2026-09-16T00:00:00.000Z',
  pausedAt: null,
  totalPausedSeconds: 0,
  completedAt: null,
  durationSeconds: null,
  completionSource: null,
  version: 1,
  createdAt: '2026-09-16T00:00:00.000Z',
  updatedAt: '2026-09-16T00:00:00.000Z',
}

function createFakeTransport(response: unknown = session) {
  const calls: Array<{ operation: string; input: unknown; options: unknown }> = []
  const transport: MiniprogramTransport = {
    call: vi.fn(async (operation: string, input: never, options: never) => {
      calls.push({ operation, input, options })
      return response as never
    }),
  }
  return { calls, transport }
}

describe('study-sessions-service 学习会话服务', () => {
  it('开始会话透传调用方幂等键', async () => {
    const { transport, calls } = createFakeTransport()
    const service = createStudySessionsService(transport)
    await service.create({ topicId: 't-1', idempotencyKey: 'start-key-1' } as never)
    expect(calls[0]).toMatchObject({ operation: 'studySessions.create' })
    expect(calls[0].options).toEqual({ idempotencyKey: 'start-key-1' })
    // 幂等键只进传输选项，不进入业务请求体。
    expect(calls[0].input).toEqual({ topicId: 't-1' })
  })

  it('暂停与恢复使用调用方幂等键，不生成确定性键', async () => {
    const { transport, calls } = createFakeTransport()
    const service = createStudySessionsService(transport)
    const command = { sessionId: 's-1', version: 1, idempotencyKey: 'pause-key-1' } as never
    await service.pause(command)
    await service.resume(command)
    expect(calls.map((call) => call.operation)).toEqual([
      'studySessions.pause',
      'studySessions.resume',
    ])
    // 回归：确定性键（pause-<sessionId>）会让第二次操作撞上服务端幂等去重 409。
    expect(calls[0].options).toEqual({ idempotencyKey: 'pause-key-1' })
    expect(calls[1].options).toEqual({ idempotencyKey: 'pause-key-1' })
  })

  it('完成会话拆出幂等键后提交业务字段', async () => {
    const completion = {
      session: { ...session, status: 'completed', version: 2 },
      learningLog: {
        id: '33333333-3333-4333-8333-333333333333',
        userId: '22222222-2222-4222-8222-222222222222',
        sessionId: session.id,
        topicId: '44444444-4444-4444-8444-444444444444',
        gains: '学到了',
        problems: null,
        nextStep: null,
        effectiveDurationSeconds: 600,
        version: 1,
        createdAt: '2026-09-16T02:00:00.000Z',
        updatedAt: '2026-09-16T02:00:00.000Z',
      },
    }
    const { transport, calls } = createFakeTransport(completion)
    const service = createStudySessionsService(transport)
    await service.complete({
      sessionId: 's-1',
      version: 2,
      idempotencyKey: 'complete-key-1',
      endedAt: '2026-09-16T02:00:00.000Z',
    } as never)
    expect(calls[0].operation).toBe('studySessions.complete')
    expect(calls[0].options).toEqual({ idempotencyKey: 'complete-key-1' })
    expect(calls[0].input).toMatchObject({ sessionId: 's-1', version: 2 })
    expect(calls[0].input).not.toHaveProperty('idempotencyKey')
  })
})
