import { describe, expect, it } from 'vitest'
import { activeTopicPageFixture } from '../../contracts/topic'
import { FakeHttpTransport } from '../../http'
import { TopicClient } from './topic-client'

describe('TopicClient', () => {
  it('queries only active topics and encodes cursor', async () => {
    const transport = new FakeHttpTransport(() => activeTopicPageFixture)
    const page = await new TopicClient(transport).listActive({
      limit: 20,
      cursor: 'next+page',
    })
    expect(page).toEqual(activeTopicPageFixture)
    expect(transport.requests[0]).toMatchObject({
      method: 'GET',
      path: '/topics?status=active&limit=20&cursor=next%2Bpage',
    })
  })

  it('defaults to 100 active topics', async () => {
    const transport = new FakeHttpTransport(() => activeTopicPageFixture)
    await new TopicClient(transport).listActive()
    expect(transport.requests[0]?.path).toBe('/topics?status=active&limit=100')
  })

  it('does not call the transport for invalid input', () => {
    const transport = new FakeHttpTransport(() => activeTopicPageFixture)
    expect(() => new TopicClient(transport).listActive({ limit: 0 })).toThrow()
    expect(transport.requests).toHaveLength(0)
  })
})
