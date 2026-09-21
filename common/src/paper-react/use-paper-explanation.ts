import { useCallback, useEffect, useRef, useState } from 'react'
import type { PaperExplainOutput } from '@studycommit/rpc-contracts/ai'
import type { AiApi } from '../ports/ai'

/**
 * 解释卡 Hook(计费版):
 * - 不再自动生成:挂载只取报价,首卡与"换一种解释"都需用户明确点击;
 * - 每次生成使用稳定幂等键(同一轮重试复用),断线重开按 runId 恢复;
 * - 轮询 getRun 直到 completed/failed;历史查看与确认(明白了)不扣费;
 * - round 上限 3 与服务端收敛规则一致。
 */
export function usePaperExplanation({
  paperId,
  content,
  ai,
  createIdempotencyKey,
  onConfirmed,
}: {
  paperId: string
  content: string
  ai: AiApi
  /** 平台注入的幂等键生成器(桌面 IPC/移动端各自实现)。 */
  createIdempotencyKey: () => string
  onConfirmed: () => void
}) {
  const [price, setPrice] = useState<{ credits: number; version: number } | null>(null)
  const [cards, setCards] = useState<PaperExplainOutput[]>([])
  const [index, setIndex] = useState(0)
  const [lastRead, setLastRead] = useState(0)
  const [busy, setBusy] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingText, setPendingText] = useState('')
  const generation = useRef(0)
  const locked = useRef(false)
  const callback = useRef(onConfirmed)
  callback.current = onConfirmed

  // round → 幂等键:同轮重试复用同一键,断线重开恢复同一运行。
  const keysByRound = useRef(new Map<number, string>())
  const runsByRound = useRef(new Map<number, string>())
  /** 已成功落卡的轮次:跨闭包防重复计费。 */
  const settledRounds = useRef(new Set<number>())

  useEffect(() => {
    generation.current += 1
    setCards([])
    setIndex(0)
    setLastRead(0)
    setBusy(false)
    setError(null)
    setPendingText('')
    keysByRound.current.clear()
    runsByRound.current.clear()
    void ai
      .quote()
      .then((quote) => setPrice({ credits: quote.priceCredits, version: quote.priceVersion }))
      .catch(() => setPrice(null))
  }, [ai, paperId])

  const pollRun = useCallback(
    async (round: number, runId: string, epoch: number): Promise<PaperExplainOutput | null> => {
      for (let attempt = 0; attempt < 240; attempt += 1) {
        if (epoch !== generation.current) {
return null
}
        const run = await ai.getRun(runId)
        if (epoch !== generation.current) {
return null
}
        if (run.status === 'completed' && run.output) {
          return run.output
        }
        if (run.status === 'failed') {
          setError(
            run.runPhase === 'expired'
              ? '生成超时,积分已退回,可重试。'
              : (run.error ?? '解释生成失败,积分已退回,可重试。'),
          )
          return null
        }
        setPendingText('正在生成,请稍候…')
        await new Promise((resolve) => setTimeout(resolve, attempt < 10 ? 500 : 1500))
      }
      if (epoch === generation.current) {
        setError('等待结果超时,请稍后重开页面查询;超时后积分会自动退回。')
      }
      return null
    },
    [ai],
  )

  const prepare = useCallback(
    async (round: number): Promise<PaperExplainOutput | null> => {
      const epoch = generation.current
      setPreparing(true)
      setError(null)
      setPendingText('')
      try {
        const key = keysByRound.current.get(round) ?? createIdempotencyKey()
        keysByRound.current.set(round, key)
        const run = await ai.explainRun(
          {
            paperId,
            content,
            round: round + 1,
            directive: round === 0 ? 'initial' : 'plainer',
            previousViewType: cards[round - 1]?.view.type,
          },
          { priceCredits: price?.credits ?? 0, priceVersion: price?.version ?? 0 },
          key,
        )
        if (epoch !== generation.current) {
return null
}
        runsByRound.current.set(round, run.runId)
        const output = await pollRun(round, run.runId, epoch)
        if (epoch !== generation.current || !output) {
return null
}
        setCards((previous) => {
          const merged = [...previous.slice(0, round)]
          merged[round] = output
          return merged
        })
        return output
      } catch (reason) {
        if (epoch !== generation.current) {
return null
}
        const message = reason instanceof Error ? reason.message : ''
        setError(
          /PRICE_CHANGED/i.test(message)
            ? '价格已更新,请重新确认费用后重试。'
            : /INSUFFICIENT/i.test(message)
              ? '积分余额不足,可先领取活动积分。'
              : /IDEMPOTENCY_KEY_REUSED/i.test(message)
                ? '请求已被使用过,请刷新页面后重试。'
                : message || '解释生成受理失败,请稍后重试。',
        )
        return null
      } finally {
        if (epoch === generation.current) {
          setPreparing(false)
          setPendingText('')
        }
      }
    },
    [ai, cards, content, createIdempotencyKey, paperId, pollRun, price],
  )

  /** 首卡:用户点击"生成解释(¥积分)"后调用。 */
  const generateFirst = useCallback(async () => {
    if (locked.current || settledRounds.current.has(0)) {
return
}
    locked.current = true
    setBusy(true)
    const epoch = generation.current
    try {
      const output = await prepare(0)
      if (output && epoch === generation.current) {
        settledRounds.current.add(0)
        setLastRead(0)
      }
    } finally {
      if (epoch === generation.current) {
        locked.current = false
        setBusy(false)
      }
    }
  }, [cards, prepare])

  /** 换一种解释:明确的用户动作,新一轮计费。 */
  const advance = async (animate?: () => Promise<void>) => {
    if (locked.current || !cards[index]) {
return
}
    if (index >= 2) {
      setError('已到最后一种解释,可以回看或先放一放。')
      return
    }
    if (settledRounds.current.has(index + 1)) {
      // 已有下一卡缓存,直接翻页。
      void animate?.()
      setIndex(index + 1)
      setLastRead((value) => Math.max(value, index + 1))
      return
    }
    locked.current = true
    setBusy(true)
    setError(null)
    const epoch = generation.current
    try {
      const next = cards[index + 1] ?? (await prepare(index + 1))
      if (next && epoch === generation.current) {
        settledRounds.current.add(index + 1)
      }
      if (!next || epoch !== generation.current) {
return
}
      await animate?.()
      if (epoch === generation.current) {
        setIndex(index + 1)
        setLastRead((value) => Math.max(value, index + 1))
      }
    } finally {
      if (epoch === generation.current) {
        locked.current = false
        setBusy(false)
      }
    }
  }

  /** 确认理解:历史动作,不产生新计费。 */
  const confirm = async (animate?: () => Promise<void>) => {
    if (locked.current || !cards[index]) {
return
}
    const runId = runsByRound.current.get(index)
    if (!runId) {
return
}
    locked.current = true
    setBusy(true)
    setError(null)
    const epoch = generation.current
    try {
      await ai.confirmPaperExplain({ runId })
      if (epoch !== generation.current) {
return
}
      await animate?.()
      if (epoch === generation.current) {
        callback.current()
      }
    } catch {
      if (epoch === generation.current) {
        setError('确认失败，当前解释和问题状态已保留，请重试。')
      }
    } finally {
      if (epoch === generation.current) {
        locked.current = false
        setBusy(false)
      }
    }
  }

  return {
    price,
    current: cards[index],
    next: cards[index + 1],
    history: cards.slice(0, lastRead + 1),
    index,
    busy,
    preparing,
    pendingText,
    error,
    generateFirst,
    advance,
    confirm,
    /** 错误重试:首卡失败重发首卡;后续卡失败重试当前轮(幂等键复用,不重复扣费)。 */
    retry: () => {
      setError(null)
      if (cards[index] && index >= 1 && !cards[index + 1]) {
        void prepare(index + 1)
        return
      }
      if (!cards[0]) {
        void generateFirst()
      }
    },
    select: (position: number) => {
      if (!locked.current && cards[position]) {
        setIndex(position)
        setError(null)
      }
    },
  }
}
