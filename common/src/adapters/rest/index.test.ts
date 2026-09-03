import { describe, expect, it } from 'vitest'
import { FakeHttpTransport } from '../../http/fake-http-transport'
import { LearningLogClient } from '../../clients/learning-log/learning-log-client'
import { AiClient } from '../../clients/ai/ai-client'
import { StudySessionClient } from '../../clients/study-session/study-session-client'
import { TopicClient } from '../../clients/topic/topic-client'
import { createRestServices } from './index'

describe('createRestServices', () => {
  it('creates every stable business port from the same transport', () => {
    const transport = new FakeHttpTransport(() => ({}))
    const services = createRestServices(transport)

    expect(services.studySessions).toBeInstanceOf(StudySessionClient)
    expect(services.topics).toBeInstanceOf(TopicClient)
    expect(services.learningLogs).toBeInstanceOf(LearningLogClient)
    expect(services.ai).toBeInstanceOf(AiClient)
  })
})
