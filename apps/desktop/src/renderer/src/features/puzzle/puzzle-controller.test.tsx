import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import {
  usePuzzleCollection,
  usePuzzleReveal,
  type PuzzleHost,
} from '@studycommit/common/puzzle-react'
import { emptyPuzzle, type PuzzlePaper } from '@studycommit/common/puzzle-runtime'
const papers: PuzzlePaper[] = Array.from({ length: 3 }, (_, i) => ({
  id: String(i),
  content: '旧记录',
  status: 'inbox',
  createdAt: '2020-01-01T00:00:00Z',
}))
function host(): PuzzleHost {
  return {
    load: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    organize: vi.fn().mockResolvedValue(undefined),
  }
}
describe('puzzle-controller', () => {
  it('远端整理失败时不累计且保留当前记录重试', async () => {
    const h = host()
    vi.mocked(h.organize).mockRejectedValue(new Error('网络失败'))
    const { result } = renderHook(() => usePuzzleCollection(h, papers))
    await waitFor(() => expect(result.current.state).not.toBeNull())
    act(() => result.current.startGroup())
    await act(() => result.current.organize('topic'))
    expect(result.current.state?.credit).toBe(0)
    expect(result.current.position).toBe(0)
    expect(result.current.state?.intent).toBeNull()
    expect(result.current.error).toContain('网络失败')
  })
  it('跳过不补位不发奖且下一组不重复跳过记录', async () => {
    const h = host()
    const { result } = renderHook(() => usePuzzleCollection(h, papers))
    await waitFor(() => expect(result.current.state).not.toBeNull())
    act(() => result.current.startGroup())
    act(() => result.current.skip())
    expect(result.current.group).toHaveLength(3)
    expect(result.current.position).toBe(1)
    expect(result.current.state?.credit).toBe(0)
    act(() => result.current.startGroup())
    expect(result.current.group.map((p) => p.id)).toEqual(['1', '2'])
  })
  it('发奖写入成功后才能揭晓并在完成后持久化归位', async () => {
    const h = host()
    const { result } = renderHook(() => usePuzzleCollection(h, papers))
    await waitFor(() => expect(result.current.state).not.toBeNull())
    act(() => result.current.startGroup())
    for (let i = 0; i < 3; i++) {
      await act(() => result.current.organize('topic'))
    }
    expect(result.current.state?.earned).toHaveLength(1)
    expect(result.current.state?.pending).not.toBeNull()
    await act(() => result.current.finishReveal())
    expect(result.current.state?.pending).toBeNull()
    expect(vi.mocked(h.save).mock.lastCall?.[0].pending).toBeNull()
  })
  it('奖励写入失败保留整理意图并从已归位记录恢复', async () => {
    const h = host()
    vi.mocked(h.load).mockResolvedValue({ ...emptyPuzzle(), credit: 2 })
    vi.mocked(h.save)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('磁盘失败'))
      .mockResolvedValue(undefined)
    const { result, rerender } = renderHook(({ items }) => usePuzzleCollection(h, items), {
      initialProps: { items: papers },
    })
    await waitFor(() => expect(result.current.state).not.toBeNull())
    act(() => result.current.startGroup())
    await act(() => result.current.organize('topic'))
    expect(result.current.state?.pending).toBeNull()
    expect(result.current.state?.intent?.paper.id).toBe('0')
    rerender({
      items: papers.map((p) =>
        p.id === '0' ? { ...p, status: 'organized', topicId: 'topic' } : p,
      ),
    })
    await act(() => result.current.recover())
    expect(result.current.state?.earned).toHaveLength(1)
  })
  it('减少动态效果时直接到达完成状态', () => {
    const { result } = renderHook(() =>
      usePuzzleReveal(true, { reveal: 200, hold: 350, target: 150, flight: 450, settle: 240 }),
    )
    act(() => result.current.reveal())
    expect(result.current.phase).toBe('done')
  })
})
