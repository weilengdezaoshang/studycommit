import { describe, expect, it } from 'vitest'
import { emptyLearningLogFixture } from '../../contracts/learning-log'
import { FakeHttpTransport } from '../../http'
import { LearningLogClient } from './learning-log-client'

describe('LearningLogClient', () => {
  it('gets the log by session id', async () => {
    const transport = new FakeHttpTransport(() => emptyLearningLogFixture)
    await new LearningLogClient(transport).getBySession(emptyLearningLogFixture.sessionId)
    expect(transport.requests[0]).toMatchObject({
      method: 'GET',
      path: `/study-sessions/${emptyLearningLogFixture.sessionId}/learning-log`,
    })
  })

  it('sends only editable summary fields in the patch body', async () => {
    const transport = new FakeHttpTransport(() => ({
      ...emptyLearningLogFixture,
      gains: '理解事务',
      version: 2,
    }))
    await new LearningLogClient(transport).update({
      id: emptyLearningLogFixture.id,
      version: 1,
      gains: '理解事务',
    })
    expect(transport.requests[0]).toMatchObject({
      method: 'PATCH',
      path: `/learning-logs/${emptyLearningLogFixture.id}`,
      body: { version: 1, gains: '理解事务' },
    })
  })
})
