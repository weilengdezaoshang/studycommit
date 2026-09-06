import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { drizzle } from 'drizzle-orm/node-postgres'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { applyTestEnv, testEnv } from '../helpers/env'

describe('StudySessions API', () => {
  let app: NestFastifyApplication
  const pool = new Pool({ connectionString: testEnv.DATABASE_URL })
  const user = '11111111-1111-4111-8111-111111111111'
  const other = '22222222-2222-4222-8222-222222222222'
  const headers = (key = crypto.randomUUID(), owner = user) => ({
    'x-user-id': owner,
    'idempotency-key': key,
  })

  beforeAll(async () => {
    applyTestEnv()
    await migrate(drizzle(pool), { migrationsFolder: './drizzle' })
    const module = await import('../../src/app.factory.js')
    app = await module.createApp()
  })
  beforeEach(async () => {
    await pool.query(
      'truncate papers, learning_logs, study_sessions, idempotency_records, topics restart identity cascade',
    )
  })
  afterAll(async () => {
    await app.close()
    await pool.end()
  })

  async function createTopic(name = 'Node.js') {
    return (
      await app.inject({
        method: 'POST',
        url: '/api/topics',
        headers: headers(),
        payload: { name, color: '#4F46E5' },
      })
    ).json()
  }

  it('starts, pauses, resumes and completes one shared session', async () => {
    const topic = await createTopic()
    const started = await app.inject({
      method: 'POST',
      url: '/api/study-sessions',
      headers: headers('start'),
      payload: { topicId: topic.id, goal: '学习事务' },
    })
    expect(started.statusCode).toBe(200)
    const session = started.json()

    const active = (
      await app.inject({
        method: 'GET',
        url: '/api/study-sessions/active',
        headers: { 'x-user-id': user },
      })
    ).json()
    expect(active.session).toMatchObject({ id: session.id, status: 'running', version: 1 })
    expect(active.serverNow).toBeTruthy()

    const paused = (
      await app.inject({
        method: 'POST',
        url: `/api/study-sessions/${session.id}/pause`,
        headers: headers('pause'),
        payload: { version: 1 },
      })
    ).json()
    expect(paused).toMatchObject({ status: 'paused', version: 2 })
    const resumed = (
      await app.inject({
        method: 'POST',
        url: `/api/study-sessions/${session.id}/resume`,
        headers: headers('resume'),
        payload: { version: 2 },
      })
    ).json()
    expect(resumed).toMatchObject({ status: 'running', version: 3 })
    const completed = (
      await app.inject({
        method: 'POST',
        url: `/api/study-sessions/${session.id}/complete`,
        headers: headers('complete'),
        payload: { version: 3 },
      })
    ).json()
    expect(completed).toMatchObject({
      session: {
        status: 'completed',
        version: 4,
        completionSource: 'online',
      },
      learningLog: {
        sessionId: session.id,
        topicId: topic.id,
        gains: null,
        problems: null,
        nextStep: null,
      },
    })
    expect(completed.session.durationSeconds).toBeGreaterThanOrEqual(0)
    expect(completed.learningLog.effectiveDurationSeconds).toBe(completed.session.durationSeconds)
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/api/study-sessions/active',
          headers: { 'x-user-id': user },
        })
      ).json().session,
    ).toBeNull()
  })

  it('replays a command and prevents deleting a topic with an active session', async () => {
    const topic = await createTopic()
    const first = await app.inject({
      method: 'POST',
      url: '/api/study-sessions',
      headers: headers('same-start'),
      payload: { topicId: topic.id },
    })
    const replay = await app.inject({
      method: 'POST',
      url: '/api/study-sessions',
      headers: headers('same-start'),
      payload: { topicId: topic.id },
    })
    expect(replay.json().id).toBe(first.json().id)
    expect(replay.headers['idempotency-replayed']).toBe('true')
    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/topics/${topic.id}`,
      headers: { 'x-user-id': user },
      payload: { version: 1 },
    })
    expect(removed.statusCode).toBe(409)
    expect(removed.json().code).toBe('TOPIC_HAS_ACTIVE_SESSION')
  })

  it('serializes concurrent starts and duplicate pause commands', async () => {
    const topic = await createTopic()
    const starts = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/api/study-sessions',
        headers: headers('start-a'),
        payload: { topicId: topic.id },
      }),
      app.inject({
        method: 'POST',
        url: '/api/study-sessions',
        headers: headers('start-b'),
        payload: { topicId: topic.id },
      }),
    ])
    expect(starts.map((response) => response.statusCode).sort()).toEqual([200, 409])
    const session = starts.find((response) => response.statusCode === 200)!.json()

    const pauses = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/api/study-sessions/${session.id}/pause`,
        headers: headers('same-pause'),
        payload: { version: 1 },
      }),
      app.inject({
        method: 'POST',
        url: `/api/study-sessions/${session.id}/pause`,
        headers: headers('same-pause'),
        payload: { version: 1 },
      }),
    ])
    expect(pauses.map((response) => response.statusCode)).toEqual([200, 200])
    expect(pauses[0].json()).toMatchObject({ status: 'paused', version: 2 })
    expect(pauses[1].json().pausedAt).toBe(pauses[0].json().pausedAt)
  })

  it('does not count the current paused interval when completing', async () => {
    const topic = await createTopic()
    const session = (
      await app.inject({
        method: 'POST',
        url: '/api/study-sessions',
        headers: headers(),
        payload: { topicId: topic.id },
      })
    ).json()
    await app.inject({
      method: 'POST',
      url: `/api/study-sessions/${session.id}/pause`,
      headers: headers(),
      payload: { version: 1 },
    })
    await pool.query(
      "update study_sessions set started_at = now() - interval '2 hours', paused_at = now() - interval '1 hour' where id = $1",
      [session.id],
    )
    const completed = (
      await app.inject({
        method: 'POST',
        url: `/api/study-sessions/${session.id}/complete`,
        headers: headers(),
        payload: { version: 2 },
      })
    ).json()
    expect(completed.session.status).toBe('completed')
    expect(completed.session.durationSeconds).toBeGreaterThanOrEqual(3599)
    expect(completed.session.durationSeconds).toBeLessThanOrEqual(3601)
    expect(completed.learningLog.effectiveDurationSeconds).toBe(completed.session.durationSeconds)
  })

  it('isolates sessions and rejects unusable topics', async () => {
    const topic = await createTopic()
    const session = (
      await app.inject({
        method: 'POST',
        url: '/api/study-sessions',
        headers: headers(),
        payload: { topicId: topic.id },
      })
    ).json()
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/api/study-sessions/${session.id}`,
          headers: { 'x-user-id': other },
        })
      ).statusCode,
    ).toBe(404)
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/study-sessions/${session.id}/pause`,
          headers: headers(crypto.randomUUID(), other),
          payload: { version: 1 },
        })
      ).statusCode,
    ).toBe(404)

    const archived = await createTopic('已归档')
    await app.inject({
      method: 'PATCH',
      url: `/api/topics/${archived.id}`,
      headers: { 'x-user-id': user },
      payload: { status: 'archived', version: 1 },
    })
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/study-sessions',
          headers: headers(),
          payload: { topicId: archived.id },
        })
      ).json().code,
    ).toBe('TOPIC_NOT_FOUND')

    const foreign = (
      await app.inject({
        method: 'POST',
        url: '/api/topics',
        headers: headers(crypto.randomUUID(), other),
        payload: { name: 'Other', color: '#000000' },
      })
    ).json()
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/study-sessions',
          headers: headers(),
          payload: { topicId: foreign.id },
        })
      ).json().code,
    ).toBe('TOPIC_NOT_FOUND')

    const deleted = await createTopic('已删除')
    await app.inject({
      method: 'DELETE',
      url: `/api/topics/${deleted.id}`,
      headers: { 'x-user-id': user },
      payload: { version: 1 },
    })
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/study-sessions',
          headers: headers(),
          payload: { topicId: deleted.id },
        })
      ).json().code,
    ).toBe('TOPIC_NOT_FOUND')
  })

  it('allows deleting a topic after the session is completed', async () => {
    const topic = await createTopic()
    const session = (
      await app.inject({
        method: 'POST',
        url: '/api/study-sessions',
        headers: headers(),
        payload: { topicId: topic.id },
      })
    ).json()
    await app.inject({
      method: 'POST',
      url: `/api/study-sessions/${session.id}/complete`,
      headers: headers(),
      payload: { version: 1 },
    })
    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/topics/${topic.id}`,
      headers: { 'x-user-id': user },
      payload: { version: 1 },
    })
    expect(removed.statusCode).toBe(200)
  })

  it('accepts offline completion and rejects an end time before start', async () => {
    const topic = await createTopic()
    const session = (
      await app.inject({
        method: 'POST',
        url: '/api/study-sessions',
        headers: headers(),
        payload: { topicId: topic.id },
      })
    ).json()
    const tooEarly = await app.inject({
      method: 'POST',
      url: `/api/study-sessions/${session.id}/complete`,
      headers: headers(),
      payload: {
        version: 1,
        completionSource: 'offline_sync',
        endedAt: new Date(Date.parse(session.startedAt) - 60_000).toISOString(),
      },
    })
    expect(tooEarly.statusCode).toBe(400)
    expect(tooEarly.json().code).toBe('INVALID_SESSION_END_TIME')

    const completed = await app.inject({
      method: 'POST',
      url: `/api/study-sessions/${session.id}/complete`,
      headers: headers(),
      payload: {
        version: 1,
        completionSource: 'offline_sync',
        endedAt: new Date(Date.parse(session.startedAt) + 2000).toISOString(),
      },
    })
    expect(completed.statusCode).toBe(200)
    expect(completed.json()).toMatchObject({
      session: {
        status: 'completed',
        completionSource: 'offline_sync',
      },
    })
  })

  it('creates one learning log, adds topic duration, and replays the same log', async () => {
    const topic = await createTopic()
    const session = (
      await app.inject({
        method: 'POST',
        url: '/api/study-sessions',
        headers: headers(),
        payload: { topicId: topic.id },
      })
    ).json()
    await pool.query(
      "update study_sessions set started_at = now() - interval '10 minutes' where id = $1",
      [session.id],
    )
    const first = await app.inject({
      method: 'POST',
      url: `/api/study-sessions/${session.id}/complete`,
      headers: headers('complete-once'),
      payload: { version: 1 },
    })
    expect(first.statusCode).toBe(200)
    const created = first.json()
    expect(created.learningLog.sessionId).toBe(session.id)
    expect(created.learningLog.effectiveDurationSeconds).toBe(created.session.durationSeconds)

    const replay = await app.inject({
      method: 'POST',
      url: `/api/study-sessions/${session.id}/complete`,
      headers: headers('complete-once'),
      payload: { version: 1 },
    })
    expect(replay.statusCode).toBe(200)
    expect(replay.headers['idempotency-replayed']).toBe('true')
    expect(replay.json().learningLog.id).toBe(created.learningLog.id)

    const latestTopic = (
      await app.inject({
        method: 'GET',
        url: `/api/topics/${topic.id}`,
        headers: { 'x-user-id': user },
      })
    ).json()
    expect(latestTopic.totalDurationSeconds).toBe(created.session.durationSeconds)
  })
  it('从截图草稿开始学习:创建纸页、记片段、收尾回写理解并生成下一个问题', async () => {
    const paperId = crypto.randomUUID()
    const started = await app.inject({
      method: 'POST',
      url: '/api/study-sessions',
      headers: headers('start-capture'),
      payload: {
        draftPaper: { paperId, questionText: 'React 调度器为什么用优先级队列' },
      },
    })
    expect(started.statusCode).toBe(200)
    const session = started.json()
    expect(session).toMatchObject({
      source: 'desktop_capture',
      paperId,
      topicId: null,
      status: 'running',
    })

    const active = (
      await app.inject({
        method: 'GET',
        url: '/api/study-sessions/active',
        headers: { 'x-user-id': user },
      })
    ).json()
    expect(active.paper).toMatchObject({
      id: paperId,
      questionText: 'React 调度器为什么用优先级队列',
      understandingText: null,
      fragmentCount: 0,
    })

    const fragmentId = crypto.randomUUID()
    const fragment = await app.inject({
      method: 'POST',
      url: `/api/study-sessions/${session.id}/fragments`,
      headers: headers('fragment-1'),
      payload: { fragmentId, content: '小顶堆按过期时间取任务' },
    })
    expect(fragment.statusCode).toBe(201)
    expect(fragment.json()).toMatchObject({ id: fragmentId, position: 0, version: 1 })

    // 同一 fragmentId 重试(不同幂等键):返回同一片段,不产生重复
    const fragmentRetry = await app.inject({
      method: 'POST',
      url: `/api/study-sessions/${session.id}/fragments`,
      headers: headers('fragment-1-retry'),
      payload: { fragmentId, content: '小顶堆按过期时间取任务' },
    })
    expect(fragmentRetry.statusCode).toBe(201)
    expect(fragmentRetry.json().id).toBe(fragmentId)
    expect(fragmentRetry.headers['idempotency-replayed']).toBe('true')

    const secondFragmentId = crypto.randomUUID()
    const secondFragment = await app.inject({
      method: 'POST',
      url: `/api/study-sessions/${session.id}/fragments`,
      headers: headers('fragment-2'),
      payload: { fragmentId: secondFragmentId, content: 'lane 模型决定更新顺序' },
    })
    expect(secondFragment.json().position).toBe(1)

    const nextPaperId = crypto.randomUUID()
    const completed = await app.inject({
      method: 'POST',
      url: `/api/study-sessions/${session.id}/complete-paper`,
      headers: headers('complete-paper'),
      payload: {
        version: 1,
        understandingText: '调度器用小顶堆管理任务过期时间,lane 决定优先级',
        nextQuestionText: '并发渲染中断后如何恢复',
        nextPaperId,
      },
    })
    expect(completed.statusCode).toBe(200)
    const completedBody = completed.json()
    expect(completedBody.session).toMatchObject({
      status: 'completed',
      completionSource: 'online',
      version: 2,
    })
    expect(completedBody.paper).toMatchObject({
      id: paperId,
      understandingText: '调度器用小顶堆管理任务过期时间,lane 决定优先级',
      questionStatus: 'thinking',
    })
    expect(completedBody.nextPaper).toMatchObject({
      id: nextPaperId,
      content: '并发渲染中断后如何恢复',
      questionStatus: 'thinking',
      source: 'desktop_session',
      sourceSessionId: session.id,
    })

    // 会话完成后不再接受片段
    const rejectedFragment = await app.inject({
      method: 'POST',
      url: `/api/study-sessions/${session.id}/fragments`,
      headers: headers('fragment-3'),
      payload: { fragmentId: crypto.randomUUID(), content: '迟到的片段' },
    })
    expect(rejectedFragment.statusCode).toBe(409)
    expect(rejectedFragment.json().code).toBe('SESSION_ALREADY_COMPLETED')
  })

  it('主题路径的会话没有纸页时收尾接口报错且旧收尾不受影响', async () => {
    const topic = await createTopic()
    const started = await app.inject({
      method: 'POST',
      url: '/api/study-sessions',
      headers: headers('start-topic'),
      payload: { topicId: topic.id },
    })
    expect(started.statusCode).toBe(200)
    const session = started.json()

    const rejected = await app.inject({
      method: 'POST',
      url: `/api/study-sessions/${session.id}/complete-paper`,
      headers: headers('complete-paper-no-paper'),
      payload: { version: 1, understandingText: '没有纸页可回写' },
    })
    expect(rejected.statusCode).toBe(400)
    expect(rejected.json().code).toBe('SESSION_PAPER_REQUIRED')

    const completed = await app.inject({
      method: 'POST',
      url: `/api/study-sessions/${session.id}/complete`,
      headers: headers('complete-legacy'),
      payload: { version: 1 },
    })
    expect(completed.statusCode).toBe(200)
    expect(completed.json().learningLog.topicId).toBe(topic.id)
  })

  it('起步方式必须三选一且既有问题路径要求纸页存在', async () => {
    const topic = await createTopic()
    const both = await app.inject({
      method: 'POST',
      url: '/api/study-sessions',
      headers: headers('start-both'),
      payload: {
        topicId: topic.id,
        draftPaper: { paperId: crypto.randomUUID(), questionText: '重复来源' },
      },
    })
    expect(both.statusCode).toBe(400)

    const missingPaper = await app.inject({
      method: 'POST',
      url: '/api/study-sessions',
      headers: headers('start-missing-paper'),
      payload: { paperId: crypto.randomUUID() },
    })
    expect(missingPaper.statusCode).toBe(404)
    expect(missingPaper.json().code).toBe('SESSION_PAPER_NOT_FOUND')

    const createdPaper = (
      await app.inject({
        method: 'POST',
        url: '/api/papers',
        headers: headers('create-paper'),
        payload: { content: '既有问题纸页', questionText: '什么是事件循环' },
      })
    ).json()
    const started = await app.inject({
      method: 'POST',
      url: '/api/study-sessions',
      headers: headers('start-existing-question'),
      payload: { paperId: createdPaper.id },
    })
    expect(started.statusCode).toBe(200)
    expect(started.json()).toMatchObject({
      source: 'desktop_existing_question',
      paperId: createdPaper.id,
      topicId: null,
    })
  })
})
