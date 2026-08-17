import { describe, expect, it } from 'vitest'
import {
  DEFAULT_NAVIGATION_PREFERENCES,
  loadNavigationPreferences,
  saveNavigationPreferences,
} from './navigation-preferences'

describe('navigation preferences', () => {
  it('uses Today when no preference exists', () => {
    expect(loadNavigationPreferences(window.localStorage)).toEqual(DEFAULT_NAVIGATION_PREFERENCES)
  })

  it('restores a valid top-level page and topic section', () => {
    window.localStorage.setItem(
      'studycommit:navigation:v1',
      JSON.stringify({
        version: 1,
        lastTopLevelPath: '/drafts',
        lastTopicSectionById: { 'topic-1': 'map' },
      }),
    )

    expect(loadNavigationPreferences(window.localStorage)).toEqual({
      version: 1,
      lastTopLevelPath: '/drafts',
      lastTopicSectionById: { 'topic-1': 'map' },
    })
  })

  it.each([
    ['broken JSON', '{'],
    ['unknown version', JSON.stringify({ version: 99, lastTopLevelPath: '/today' })],
    [
      'unknown path',
      JSON.stringify({ version: 1, lastTopLevelPath: '/admin', lastTopicSectionById: {} }),
    ],
    [
      'unknown section',
      JSON.stringify({
        version: 1,
        lastTopLevelPath: '/today',
        lastTopicSectionById: { 'topic-1': 'admin' },
      }),
    ],
  ])('falls back safely for %s', (_name, value) => {
    window.localStorage.setItem('studycommit:navigation:v1', value)
    expect(loadNavigationPreferences(window.localStorage)).toEqual(DEFAULT_NAVIGATION_PREFERENCES)
  })

  it('serializes only the navigation contract', () => {
    saveNavigationPreferences(window.localStorage, {
      version: 1,
      lastTopLevelPath: '/topics',
      lastTopicSectionById: { 'topic-1': 'notes' },
    })

    expect(JSON.parse(window.localStorage.getItem('studycommit:navigation:v1')!)).toEqual({
      version: 1,
      lastTopLevelPath: '/topics',
      lastTopicSectionById: { 'topic-1': 'notes' },
    })
  })
})
