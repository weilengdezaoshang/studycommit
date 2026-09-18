import { useCallback, useEffect, useRef, useState } from 'react'
import { AdminApiError } from '@/services/api-client'

export interface CursorPage<T> {
  items: T[]
  nextCursor: string | null
}

interface Options<T, F> {
  fetchPage: (params: { cursor: string | null; limit: number } & F) => Promise<CursorPage<T>>
  filters: F
  limit?: number
  enabled?: boolean
}

/**
 * 真游标分页:把服务端 nextCursor 原样传入下一页,不编造 total.
 * filters/fetchPage 经 key/ref 稳定,避免内联对象导致循环重置.
 */
export function useCursorList<T, F extends Record<string, unknown>>(options: Options<T, F>) {
  const { fetchPage, filters, limit = 20, enabled = true } = options
  const [items, setItems] = useState<T[]>([])
  const [cursors, setCursors] = useState<Array<string | null>>([null])
  const [pageIndex, setPageIndex] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [stale, setStale] = useState(false)
  const filterKey = JSON.stringify(filters)
  const fetchRef = useRef(fetchPage)
  fetchRef.current = fetchPage
  const filtersRef = useRef(filters)
  filtersRef.current = filters
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  const requestSeq = useRef(0)

  const load = useCallback(
    async (index: number, stack: Array<string | null>) => {
      if (!enabledRef.current) {
return false
}
      const seq = ++requestSeq.current
      setLoading(true)
      try {
        const page = await fetchRef.current({
          ...(filtersRef.current as F),
          cursor: stack[index] ?? null,
          limit,
        })
        if (seq !== requestSeq.current) {
return false
}
        setItems(page.items)
        setNextCursor(page.nextCursor)
        setError(null)
        setStale(false)
        return true
      } catch (caught) {
        if (seq !== requestSeq.current) {
return false
}
        const nextError = caught instanceof Error ? caught : new Error('加载失败')
        setError(nextError)
        setStale(true)
        if (caught instanceof AdminApiError && (caught.status === 401 || caught.status === 403)) {
          setItems([])
          setNextCursor(null)
        }
        return false
      } finally {
        if (seq === requestSeq.current) {
setLoading(false)
}
      }
    },
    [limit],
  )

  useEffect(() => {
    if (!enabled) {
      requestSeq.current += 1
      setItems([])
      setCursors([null])
      setPageIndex(0)
      setNextCursor(null)
      setError(null)
      setStale(false)
      setLoading(false)
      return
    }
    setCursors([null])
    setPageIndex(0)
    setNextCursor(null)
    setItems([])
    setError(null)
    setStale(false)
    void load(0, [null])
  }, [enabled, filterKey, load])

  const hasPrev = pageIndex > 0
  const hasNext = Boolean(nextCursor)

  const goNext = useCallback(() => {
    if (!nextCursor) {
return
}
    const stack = cursors.slice(0, pageIndex + 1).concat(nextCursor)
    void load(pageIndex + 1, stack).then((ok) => {
      if (!ok) {
return
}
      setCursors(stack)
      setPageIndex(pageIndex + 1)
    })
  }, [cursors, load, nextCursor, pageIndex])

  const goPrev = useCallback(() => {
    if (pageIndex === 0) {
return
}
    const nextIndex = pageIndex - 1
    void load(nextIndex, cursors).then((ok) => {
      if (!ok) {
return
}
      setPageIndex(nextIndex)
    })
  }, [cursors, load, pageIndex])

  const reload = useCallback(() => {
    void load(pageIndex, cursors)
  }, [cursors, load, pageIndex])

  const reset = useCallback(() => {
    setCursors([null])
    setPageIndex(0)
    void load(0, [null])
  }, [load])

  return {
    items,
    loading,
    error,
    stale,
    hasPrev,
    hasNext,
    goNext,
    goPrev,
    reload,
    reset,
    pageIndex,
    nextCursor,
  }
}
