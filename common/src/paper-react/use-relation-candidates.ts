import { useEffect, useRef, useState } from 'react'
import type { SearchApi } from '../ports/search'
import type { Paper } from '@studycommit/rpc-contracts/papers'

export function useRelationCandidates(search: SearchApi, query: string, paperId: string) {
  const [items, setItems] = useState<Paper[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const generation = useRef(0)
  const locked = useRef(false)
  const run = async (next?: string) => {
    if (locked.current) {
      return
    }
    locked.current = true
    setBusy(true)
    setError(null)
    const epoch = generation.current
    try {
      const result = await search.query({ q: query.trim(), limit: 20, cursor: next })
      if (epoch === generation.current) {
        setItems((old) =>
          [...(next ? old : []), ...result.papers.items.filter((p) => p.id !== paperId)].filter(
            (p, i, all) => all.findIndex((v) => v.id === p.id) === i,
          ),
        )
        setCursor(result.papers.pageInfo.nextCursor)
      }
    } catch {
      if (epoch === generation.current) {
        setError('候选加载失败，请重试。')
      }
    } finally {
      if (epoch === generation.current) {
        locked.current = false
        setBusy(false)
      }
    }
  }
  useEffect(() => {
    generation.current++
    locked.current = false
    setItems([])
    setCursor(null)
    setError(null)
    setBusy(false)
    const timer = setTimeout(() => {
      if (query.trim()) {
        void run()
      }
    }, 250)
    return () => {
      clearTimeout(timer)
      generation.current++
    }
  }, [query, search, paperId])
  return { items, busy, error, more: !!cursor, load: () => void run(cursor ?? undefined) }
}
