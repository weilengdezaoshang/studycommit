import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePaperExplanation } from '@studycommit/common/paper-react'
import type { AiApi } from '@studycommit/common/ports'

const output = {
  runId: 'run-1',
  view: {
    type: 'causal_chain' as const,
    steps: [
      { title: '一', detail: '第一步' },
      { title: '二', detail: '第二步' },
    ],
  },
  example: '例子',
  plainLevel: 1,
  model: 'fake',
  promptVersion: 'paper-explain@1',
}

function createAi() {
  return {
    quote: vi
      .fn()
      .mockResolvedValue({
        action: 'paper_explain',
        priceCredits: 5,
        priceVersion: 1,
        balance: { available: 20, reserved: 0 },
      }),
    explainRun: vi
      .fn()
      .mockResolvedValue({
        runId: 'run-1',
        runPhase: 'queued',
        priceCredits: 5,
        priceVersion: 1,
        reservedCredits: 5,
        deadlineAt: new Date().toISOString(),
      }),
    getRun: vi.fn().mockResolvedValue({
      runId: 'run-1',
      status: 'completed',
      runPhase: 'completed',
      output,
      error: null,
      settlement: { state: 'settled', credits: 5 },
      balance: { available: 15, reserved: 0 },
    }),
    confirmPaperExplain: vi.fn().mockResolvedValue({ confirmed: true }),
  }
}

function renderHookWith(ai: AiApi) {
  return renderHook(() =>
    usePaperExplanation({
      paperId: 'paper-1',
      content: '内容',
      ai,
      createIdempotencyKey: () => 'fixed-key',
      onConfirmed: vi.fn(),
    }),
  )
}

describe('usePaperExplanation(计费版)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('挂载只取报价,不发起任何生成请求', async () => {
    const ai = createAi()
    const { result } = renderHookWith(ai)
    await waitFor(() => expect(result.current.price?.credits).toBe(5))
    expect(ai.explainRun).not.toHaveBeenCalled()
    expect(ai.getRun).not.toHaveBeenCalled()
    expect(result.current.current).toBeUndefined()
  })

  it('明确点击后才受理生成,受理即冻结并轮询到结果', async () => {
    const ai = createAi()
    const { result } = renderHookWith(ai)
    await waitFor(() => expect(result.current.price).not.toBeNull())
    await act(async () => {
      await result.current.generateFirst()
    })
    expect(ai.explainRun).toHaveBeenCalledExactlyOnceWith(
      {
        paperId: 'paper-1',
        content: '内容',
        round: 1,
        directive: 'initial',
        previousViewType: undefined,
      },
      { priceCredits: 5, priceVersion: 1 },
      'fixed-key',
    )
    expect(result.current.current?.runId).toBe('run-1')
  })

  it('重复点击不会发起第二次生成', async () => {
    const ai = createAi()
    const { result } = renderHookWith(ai)
    await waitFor(() => expect(result.current.price).not.toBeNull())
    await act(async () => {
      await result.current.generateFirst()
      await result.current.generateFirst()
    })
    expect(ai.explainRun).toHaveBeenCalledOnce()
  })
})
