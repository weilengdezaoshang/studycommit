import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { useCursorList } from '../hooks/use-cursor-list'

afterEach(cleanup)

it('禁用列表后忽略进行中的请求并清空旧数据', async () => {
  let resolve!: (value: { items: string[]; nextCursor: null }) => void
  const pending = new Promise<{ items: string[]; nextCursor: null }>((done) => {
    resolve = done
  })
  const hook = renderHook(
    ({ enabled }) => useCursorList({ filters: {}, enabled, fetchPage: () => pending }),
    { initialProps: { enabled: true } },
  )
  hook.rerender({ enabled: false })
  await act(async () => resolve({ items: ['不应再展示的结果'], nextCursor: null }))
  expect(hook.result.current.items).toEqual([])
  expect(hook.result.current.loading).toBe(false)
})

it('切换筛选后新请求失败时不将旧筛选的条目当作新结果', async () => {
  const hook = renderHook(
    ({ status }) =>
      useCursorList({
        filters: { status },
        fetchPage: async () => {
          if (status === 'draft') {
return { items: ['旧草稿'], nextCursor: null }
}
          throw new Error('读取失败')
        },
      }),
    { initialProps: { status: 'draft' } },
  )
  await waitFor(() => expect(hook.result.current.items).toEqual(['旧草稿']))
  hook.rerender({ status: 'published' })
  await waitFor(() => expect(hook.result.current.error).toBeTruthy())
  expect(hook.result.current.items).toEqual([])
})
