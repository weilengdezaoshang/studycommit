import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  useRecoverableDraft,
  type PaperDraft,
  type PaperDraftStorage,
} from '@studycommit/common/paper-react'
import { paperDraftValidationError } from '@studycommit/common/paper-runtime'
import type { PaperApi } from '@studycommit/common/ports'
import { createDesktopDraftStorage } from './draft-storage'

function setup(storage?: PaperDraftStorage) {
  const create = vi
    .fn<PaperApi['create']>()
    .mockResolvedValue({ id: 'saved' } as Awaited<ReturnType<PaperApi['create']>>)
  const draftStorage = storage ?? {
    load: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
  }
  const hook = renderHook(() =>
    useRecoverableDraft({
      draftStorage,
      papers: { create },
      createDraftId: () => 'stable-draft',
      debounceMs: 5,
    }),
  )
  return { ...hook, create, draftStorage }
}
const content = (text: string) => ({ type: 'setContent' as const, content: text, now: 1 })

describe('记录草稿恢复', () => {
  it('读取失败不覆盖原草稿并允许重新读取', async () => {
    const storage = {
      load: vi.fn().mockRejectedValueOnce(new Error('磁盘失败')).mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
    }
    const { result } = setup(storage)
    await waitFor(() => expect(result.current.loadError).toBeTruthy())
    expect(result.current.draft).toBeNull()
    expect(storage.save).not.toHaveBeenCalled()
    await act(() => result.current.retryLoad())
    expect(result.current.loadError).toBeNull()
    expect(result.current.draft?.paperId).toBe('stable-draft')
  })
  it('落盘失败保留输入且不宣称已保存', async () => {
    const { result } = setup({
      load: async () => null,
      save: async () => {
        throw new Error('空间不足')
      },
    })
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.dispatch(content('不能丢失的内容')))
    await waitFor(() => expect(result.current.storageError).toContain('未能保存到本机'))
    expect(result.current.savedAt).toBeNull()
    expect(result.current.draft?.content).toBe('不能丢失的内容')
    await act(async () => {
      await expect(result.current.persist({ content: '不能丢失的内容' })).rejects.toThrow()
    })
  })
  it('服务端失败重试复用幂等键并保留正文', async () => {
    const { result, create } = setup()
    create.mockRejectedValueOnce(new Error('断网'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.dispatch(content('主动回忆')))
    await act(() => result.current.save())
    expect(result.current.saveError).toBeTruthy()
    expect(result.current.draft?.content).toBe('主动回忆')
    await act(() => result.current.save())
    expect(create.mock.calls.map((call) => call[1]?.idempotencyKey)).toEqual([
      'stable-draft',
      'stable-draft',
    ])
    expect(result.current.draft).toBeNull()
  })
  it('已落盘的最新内容显示持久化时间且修改后立即失效', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.dispatch(content('第一版')))
    await waitFor(() => expect(result.current.savedAt).toBe(1))
    act(() => result.current.dispatch({ ...content('第二版'), now: 2 }))
    expect(result.current.savedAt).toBeNull()
  })
  it('达到正文和疑问上限可保存而超过一字被拒绝', () => {
    const draft: PaperDraft = {
      paperId: 'id',
      content: '文'.repeat(20000),
      questionText: '问'.repeat(2000),
      hasQuestion: true,
      assetUploadIds: [],
      updatedAt: 1,
      attempts: 0,
    }
    expect(paperDraftValidationError(draft)).toBeNull()
    expect(paperDraftValidationError({ ...draft, content: draft.content + '文' })).toContain('正文')
    expect(
      paperDraftValidationError({ ...draft, questionText: draft.questionText + '问' }),
    ).toContain('问题')
  })
  it('损坏的本地草稿报告错误而非返回空记录', async () => {
    const storage = { getItem: () => '{invalid', setItem: vi.fn(), removeItem: vi.fn() }
    await expect(createDesktopDraftStorage(storage).load()).rejects.toThrow('未能读取')
    expect(storage.removeItem).not.toHaveBeenCalled()
  })
})
