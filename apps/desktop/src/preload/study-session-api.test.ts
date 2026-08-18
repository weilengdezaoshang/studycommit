// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

const invoke = vi.fn()
vi.mock('electron', () => ({
  ipcRenderer: { invoke: (...args: unknown[]) => invoke(...args) },
}))

import { studyCommitPreloadApi, studySessionPreloadApi } from './study-session-api'

describe('study session preload api', () => {
  it('exposes only the six session methods and fixed channels', async () => {
    expect(Object.keys(studyCommitPreloadApi)).toEqual(['platform', 'studySessions', 'topics'])
    expect(Object.keys(studySessionPreloadApi)).toEqual([
      'create',
      'getActive',
      'getById',
      'pause',
      'resume',
      'complete',
    ])
    await studySessionPreloadApi.getActive()
    expect(invoke).toHaveBeenCalledWith('study-sessions:get-active')
    await studySessionPreloadApi.getById('11111111-1111-4111-8111-111111111111')
    expect(invoke).toHaveBeenCalledWith(
      'study-sessions:get-by-id',
      '11111111-1111-4111-8111-111111111111',
    )
    await studyCommitPreloadApi.topics.listActive()
    expect(invoke).toHaveBeenCalledWith('topics:list-active', undefined)
    expect(Object.keys(studyCommitPreloadApi.topics)).toEqual(['listActive'])
  })
})
