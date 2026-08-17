import { describe, expect, it } from 'vitest'
import { runningStudySessionFixture } from '../../contracts/study-session'
import { FakeHttpTransport } from '../../http'
import { StudySessionClient } from './study-session-client'

describe('StudySessionClient', () => {
  it('maps getActive to the active endpoint', async () => {
    const transport = new FakeHttpTransport(() => ({
      session: runningStudySessionFixture,
      serverNow: '2026-08-17T08:10:00.000Z',
    }))
    await new StudySessionClient(transport).getActive()
    expect(transport.requests[0]).toMatchObject({
      method: 'GET',
      path: '/study-sessions/active',
    })
  })

  it('puts create idempotency in the header and not the body', async () => {
    const transport = new FakeHttpTransport(() => runningStudySessionFixture)
    await new StudySessionClient(transport).create({
      topicId: runningStudySessionFixture.topicId,
      goal: '学习 IPC',
      idempotencyKey: 'create-1',
    })
    expect(transport.requests[0]).toMatchObject({
      method: 'POST',
      path: '/study-sessions',
      headers: { 'idempotency-key': 'create-1' },
      body: { topicId: runningStudySessionFixture.topicId, goal: '学习 IPC' },
    })
  })

  it.each(['pause', 'resume'] as const)('maps %s to a command endpoint', async (action) => {
    const transport = new FakeHttpTransport(() => runningStudySessionFixture)
    const client = new StudySessionClient(transport)
    await client[action]({
      sessionId: runningStudySessionFixture.id,
      version: 1,
      idempotencyKey: `${action}-1`,
    })
    expect(transport.requests[0]).toMatchObject({
      method: 'POST',
      path: `/study-sessions/${runningStudySessionFixture.id}/${action}`,
      headers: { 'idempotency-key': `${action}-1` },
      body: { version: 1 },
    })
  })

  it('encodes getById and uses the session schema', async () => {
    const transport = new FakeHttpTransport(() => runningStudySessionFixture)
    await new StudySessionClient(transport).getById(runningStudySessionFixture.id)
    expect(transport.requests[0]).toMatchObject({
      method: 'GET',
      path: `/study-sessions/${runningStudySessionFixture.id}`,
      responseSchema: expect.any(Object),
    })
  })

  it('sends only backend complete fields in the body', async () => {
    const transport = new FakeHttpTransport(() => runningStudySessionFixture)
    await new StudySessionClient(transport).complete({
      sessionId: runningStudySessionFixture.id,
      version: 1,
      idempotencyKey: 'complete-1',
      completionSource: 'online',
    })
    expect(transport.requests[0]).toMatchObject({
      method: 'POST',
      path: `/study-sessions/${runningStudySessionFixture.id}/complete`,
      headers: { 'idempotency-key': 'complete-1' },
      body: { version: 1, completionSource: 'online' },
    })
  })

  it('does not call the transport for invalid input', () => {
    const transport = new FakeHttpTransport(() => runningStudySessionFixture)
    const client = new StudySessionClient(transport)
    expect(() => client.getById('invalid-id')).toThrow()
    expect(transport.requests).toHaveLength(0)
  })
})
