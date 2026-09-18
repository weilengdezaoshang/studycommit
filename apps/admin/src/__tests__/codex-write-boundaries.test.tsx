import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useWriteAction } from '../hooks/use-write-action'

afterEach(cleanup)

it('同一帧重复触发写操作时只发起一次请求', async () => {
  let finish!: (value: string) => void
  const operation = vi.fn(
    () =>
      new Promise<string>((resolve) => {
        finish = resolve
      }),
  )
  const hook = renderHook(() => useWriteAction(3))
  let pending!: Promise<unknown>
  act(() => {
    pending = hook.result.current.run(operation)
    void hook.result.current.run(operation)
  })
  expect(operation).toHaveBeenCalledTimes(1)
  await act(async () => {
    finish('完成')
    await pending
  })
})

it('确认弹窗打开后后台刷新不会自动替换本次操作版本', () => {
  const hook = renderHook(({ version }) => useWriteAction(version), {
    initialProps: { version: 3 },
  })
  act(() => hook.result.current.openModal())
  hook.rerender({ version: 4 })
  expect(hook.result.current.expectedVersion()).toBe(3)
})
