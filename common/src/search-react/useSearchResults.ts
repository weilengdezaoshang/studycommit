import { useEffect, useMemo, useRef, useState } from 'react'
import {
  SEARCH_DEBOUNCE_MS,
  filterLocalSearchRows,
  mergeSearchRows,
  toServerSearchRows,
  type LocalSearchSource,
  type SearchQueryResult,
  type SearchRow,
} from '../search-runtime'

export interface SearchResultsState {
  query: string
  setQuery: (query: string) => void
  /** 去除首尾空格后的关键词 */
  keyword: string
  /** 当前展示行:服务端命中优先,失败或未返回时为本地过滤 */
  rows: SearchRow[]
  /** 服务端命中已就绪(关键词非空且查询成功) */
  showServer: boolean
  /** 服务端搜索失败,当前兜底展示本地过滤 */
  serverFailed: boolean
}

/**
 * 统一搜索 Hook(BE-310):防抖 + 请求序号竞态守卫的服务端查询,
 * 失败回退本地过滤,服务端与本地结果按 type-id 去重合并。
 * 网关与本地数据源由各端注入(桌面 IPC 网关、移动 oRPC 服务)。
 */
export function useSearchResults(input: {
  /** 搜索网关:桌面 IPC 网关与移动 oRPC 服务都满足该最小结构 */
  gateway: { query: (request: { q: string }) => Promise<SearchQueryResult> }
  source: LocalSearchSource
  debounceMs?: number
}): SearchResultsState {
  const { gateway, source, debounceMs = SEARCH_DEBOUNCE_MS } = input
  const [query, setQuery] = useState('')
  const keyword = query.trim()
  /** 服务端搜索结果;null 表示尚未成功(含离线回退) */
  const [serverRows, setServerRows] = useState<SearchRow[] | null>(null)
  const [serverFailed, setServerFailed] = useState(false)
  const requestSeq = useRef(0)

  useEffect(() => {
    // 空关键词不复位状态:渲染期按 keyword 派生,避免 effect 内同步 setState
    if (!keyword) {
      return
    }
    const seq = ++requestSeq.current
    const timer = setTimeout(() => {
      void gateway
        .query({ q: keyword })
        .then((result) => {
          if (requestSeq.current !== seq) {
            return
          }
          setServerRows(toServerSearchRows(result))
          setServerFailed(false)
        })
        .catch(() => {
          if (requestSeq.current === seq) {
            setServerRows(null)
            setServerFailed(true)
          }
        })
    }, debounceMs)
    return () => {
      clearTimeout(timer)
    }
  }, [keyword, gateway, debounceMs])

  const localRows = useMemo(() => filterLocalSearchRows(source, keyword), [source, keyword])

  const showServer = Boolean(keyword) && serverRows !== null
  const rows = useMemo(() => {
    if (showServer && serverRows) {
      return mergeSearchRows(serverRows, localRows)
    }
    return localRows
  }, [showServer, serverRows, localRows])

  return { query, setQuery, keyword, rows, showServer, serverFailed }
}
