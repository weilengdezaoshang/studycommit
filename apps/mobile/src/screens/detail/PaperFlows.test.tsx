import { act, renderHook, waitFor } from '@testing-library/react-native'
import { usePaperKnowledge } from '@studycommit/common/paper-react'

/**
 * 解释卡计费流程的 Hook 用例由桌面端
 * (apps/desktop paper-explanation-stream.test.tsx)与 API e2e 覆盖;
 * 此处仅覆盖移动端特有的知识追加失败重试逻辑。
 */
it('失败重试复用追加标识并保留另一种补充草稿', async () => {
  const papers = {
    knowledge: jest.fn().mockResolvedValue({ additions: [], relations: [] }),
    updateKnowledge: jest
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ additions: [], relations: [] }),
  }
  const storage = {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
  }
  const { result } = await renderHook(() =>
    usePaperKnowledge({ paperId: 'a', papers, storage, createId: () => 'stable-id' }),
  )
  await waitFor(() => expect(result.current.draftReady).toBe(true))
  await act(async () => result.current.edit('application', '实际使用'))
  await act(async () => result.current.edit('understanding', '新理解'))
  await act(async () => {
    await result.current.append('understanding')
  })
  expect(result.current.drafts.understanding).toBe('新理解')
  await act(async () => {
    await result.current.append('understanding')
  })
  expect(papers.updateKnowledge.mock.calls[0][0].additionId).toBe(
    papers.updateKnowledge.mock.calls[1][0].additionId,
  )
  expect(result.current.drafts.application).toBe('实际使用')
  expect(result.current.drafts.understanding).toBe('')
})
