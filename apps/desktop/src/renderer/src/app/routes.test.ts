import { describe, expect, it } from 'vitest'
import { isTodayNavActive, isTopicSection, routes } from './routes'

describe('routes', () => {
  it('generates top-level paths', () => {
    expect(routes.today()).toBe('/today')
    expect(routes.drafts()).toBe('/drafts')
    expect(routes.topics()).toBe('/topics')
    expect(routes.review()).toBe('/review')
    expect(routes.settings()).toBe('/settings')
  })

  it('generates topic paths and safely encodes ids', () => {
    expect(routes.topicOverview('Electron 基础')).toBe(
      '/topics/Electron%20%E5%9F%BA%E7%A1%80/overview',
    )
    expect(routes.topicNotes('topic-1')).toBe('/topics/topic-1/notes')
    expect(routes.topicMap('topic-1')).toBe('/topics/topic-1/map')
    expect(routes.topicLogs('topic-1')).toBe('/topics/topic-1/logs')
    expect(routes.note('topic/1', 'note/1')).toBe('/topics/topic%2F1/notes/note%2F1')
  })

  it('highlights Today only on the today route', () => {
    expect(isTodayNavActive('/today')).toBe(true)
    expect(isTodayNavActive('/drafts')).toBe(false)
  })

  it('accepts only known topic sections', () => {
    expect(['overview', 'notes', 'map', 'logs'].every(isTopicSection)).toBe(true)
    expect(isTopicSection('admin')).toBe(false)
    expect(isTopicSection('')).toBe(false)
    expect(isTopicSection('https://example.com')).toBe(false)
  })
})
