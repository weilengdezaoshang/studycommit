import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useCursorList } from './use-cursor-list'

describe('useCursorList', () => {
  it('把服务端 nextCursor 原样传给下一页，不编造 total', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ items: [{ id: 'a' }], nextCursor: 'cursor-2' })
      .mockResolvedValueOnce({ items: [{ id: 'b' }], nextCursor: null })

    const { result } = renderHook(() =>
      useCursorList({
        filters: { status: 'published' },
        fetchPage: ({ cursor, limit }) => fetchPage({ cursor, limit, status: 'published' }),
        limit: 1,
      }),
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fetchPage).toHaveBeenNthCalledWith(1, { cursor: null, limit: 1, status: 'published' })
    expect(result.current.items).toEqual([{ id: 'a' }])
    expect(result.current.hasNext).toBe(true)
    expect(result.current.nextCursor).toBe('cursor-2')

    await act(async () => {
      result.current.goNext()
    })
    await waitFor(() => expect(result.current.items).toEqual([{ id: 'b' }]))
    expect(fetchPage).toHaveBeenNthCalledWith(2, {
      cursor: 'cursor-2',
      limit: 1,
      status: 'published',
    })
    expect(result.current.hasNext).toBe(false)
    expect(result.current.hasPrev).toBe(true)
  })

  it('筛选变化后新请求失败时不把旧筛选结果当作新数据', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ items: [{ id: 'a' }], nextCursor: 'c1' })
      .mockRejectedValueOnce(new Error('网络中断'))

    const { result, rerender } = renderHook(
      ({ status }: { status: string }) =>
        useCursorList({
          filters: { status },
          fetchPage: ({ cursor }) => fetchPage({ cursor, status }),
        }),
      { initialProps: { status: 'draft' } },
    )
    await waitFor(() => expect(result.current.items).toEqual([{ id: 'a' }]))

    rerender({ status: 'published' })
    await waitFor(() => expect(result.current.error).toBeTruthy())
    expect(result.current.items).toEqual([])
  })

  it('disabled 时清空列表并停止请求', async () => {
    const fetchPage = vi.fn().mockResolvedValue({ items: [{ id: 'a' }], nextCursor: null })
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useCursorList({
          filters: { status: 'draft' },
          fetchPage,
          enabled,
        }),
      { initialProps: { enabled: true } },
    )
    await waitFor(() => expect(result.current.items).toEqual([{ id: 'a' }]))
    rerender({ enabled: false })
    await waitFor(() => expect(result.current.items).toEqual([]))
    const calls = fetchPage.mock.calls.length
    await act(async () => {
      result.current.reload()
    })
    expect(fetchPage.mock.calls.length).toBe(calls)
  })
})
