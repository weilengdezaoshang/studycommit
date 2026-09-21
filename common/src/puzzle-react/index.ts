import { useCallback, useEffect, useRef, useState } from 'react'
import type { PuzzleAlbum } from '@studycommit/rpc-contracts/puzzles'
import {
  emptyPuzzle,
  selectGroup,
  recordOrganized,
  validateState,
  type PuzzlePaper,
  type PuzzleState,
  type ScratchPoint,
  puzzleOverview,
} from '../puzzle-runtime'

export function usePuzzleOverview(load: (() => Promise<PuzzleAlbum>) | null, enabled = true) {
  const [album, setAlbum] = useState<PuzzleAlbum | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState(false)
  const reload = useCallback(async () => {
    if (!enabled || !load) {
return
}
    setLoading(true)
    try {
      setAlbum(await load())
      setError(false)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [enabled, load])
  useEffect(() => {
    void reload()
  }, [reload])
  return { album, overview: album ? puzzleOverview(album) : null, loading, error, reload }
}

export type PuzzleHost = {
  load: () => Promise<PuzzleState | null>
  save: (state: PuzzleState) => Promise<void>
  organize: (paperId: string, topicId: string) => Promise<void>
}
export type RevealPhase =
  'covered' | 'revealing' | 'hold' | 'target' | 'flying' | 'settling' | 'done'

/** 两端共享业务 Hook；存储与整理客户端由平台注入。一次只运行一个写操作。 */
export function usePuzzleCollection(host: PuzzleHost, papers: PuzzlePaper[]) {
  const [state, setState] = useState<PuzzleState | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [group, setGroup] = useState<PuzzlePaper[]>([])
  const [position, setPosition] = useState(0)
  const [skipped, setSkipped] = useState<string[]>([])
  const current = useRef<PuzzleState | null>(null)
  const lock = useRef(false)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  const persist = useCallback(
    async (next: PuzzleState) => {
      await host.save(next)
      current.current = next
      if (alive.current) {
        setState(next)
      }
    },
    [host],
  )
  const run = useCallback(async (task: () => Promise<void>) => {
    if (lock.current) {
      return
    }
    lock.current = true
    setBusy(true)
    setError('')
    try {
      await task()
    } catch (e) {
      if (alive.current) {
        setError(e instanceof Error ? e.message : '操作失败，请重试')
      }
    } finally {
      lock.current = false
      if (alive.current) {
        setBusy(false)
      }
    }
  }, [])
  const reload = useCallback(
    () =>
      run(async () => {
        const loaded = await host.load()
        const next = loaded ? validateState(loaded) : emptyPuzzle()
        current.current = next
        if (alive.current) {
          setState(next)
        }
      }),
    [host, run],
  )
  useEffect(() => {
    void reload()
  }, [reload])

  // 写入本地奖励失败或进程中断后，用远端已归位的纸页恢复原先意图。
  const recover = useCallback(
    (retry = false) =>
      run(async () => {
        const s = current.current
        if (!s?.intent) {
          return
        }
        const saved = papers.find((p) => p.id === s.intent!.paper.id)
        if (!saved || saved.deletedAt) {
          throw new Error('记录已删除或尚未加载，请回到首页同步后重试。')
        }
        if (saved.status !== 'organized' || saved.topicId !== s.intent.topicId) {
          if (!retry || saved.status !== 'inbox') {
            throw new Error('这条整理尚未确认，请重新归入原主题后重试恢复。')
          }
          await host.organize(saved.id, s.intent.topicId)
        }
        await persist(recordOrganized(s, s.intent.paper, new Date(), Math.random()))
      }),
    [papers, persist, run, host],
  )
  const startGroup = () => {
    setGroup(selectGroup(papers, new Date(), skipped))
    setPosition(0)
  }
  const skip = () => {
    if (busy || !group[position]) {
      return
    }
    setSkipped((items) => [...items, group[position].id])
    setPosition((p) => p + 1)
  }
  const organize = (topicId: string) =>
    run(async () => {
      const paper = group[position],
        s = current.current
      if (!paper || !s || s.intent) {
        return
      }
      const actual = papers.find((p) => p.id === paper.id)
      if (!actual || actual.deletedAt || actual.status !== 'inbox') {
        throw new Error('记录已经发生变化，请返回后重新选择一组。')
      }
      const intent = { ...s, intent: { paper, topicId } }
      await persist(intent)
      try {
        await host.organize(paper.id, topicId)
      } catch (e) {
        await persist({ ...intent, intent: null })
        throw e
      }
      await persist(recordOrganized(intent, paper, new Date(), Math.random()))
      if (alive.current) {
        setPosition((p) => p + 1)
      }
    })
  const saveStrokes = useCallback(
    (strokes: ScratchPoint[]) =>
      run(async () => {
        const s = current.current
        if (s?.pending !== null && s) {
          await persist({ ...s, strokes: strokes.slice(0, 1600) })
        }
      }),
    [persist, run],
  )
  const finishReveal = useCallback(
    () =>
      run(async () => {
        const s = current.current
        if (s && s.pending !== null) {
          await persist({ ...s, pending: null, strokes: [] })
        }
      }),
    [persist, run],
  )
  return {
    state,
    busy,
    error,
    reload,
    recover,
    group,
    position,
    startGroup,
    skip,
    organize,
    saveStrokes,
    finishReveal,
  }
}

/** 时长来自调用端的公共 Design Tokens，运行时不依赖具体动画库。 */
export function usePuzzleReveal(
  reduced: boolean,
  durations: { reveal: number; hold: number; target: number; flight: number; settle: number },
) {
  const [phase, setPhase] = useState<RevealPhase>('covered')
  const reveal = useCallback(
    () => setPhase((p) => (p === 'covered' ? (reduced ? 'done' : 'revealing') : p)),
    [reduced],
  )
  useEffect(() => {
    const sequence: RevealPhase[] = ['revealing', 'hold', 'target', 'flying', 'settling', 'done']
    const i = sequence.indexOf(phase)
    if (i < 0 || phase === 'done') {
      return
    }
    const times = [
      durations.reveal,
      durations.hold,
      durations.target,
      durations.flight,
      durations.settle,
    ]
    const timer = setTimeout(() => setPhase(sequence[i + 1]), reduced ? 0 : times[i])
    return () => clearTimeout(timer)
  }, [
    phase,
    reduced,
    durations.reveal,
    durations.hold,
    durations.target,
    durations.flight,
    durations.settle,
  ])
  return { phase, reveal }
}
