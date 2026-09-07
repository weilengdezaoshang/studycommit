import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { createDesktopSearchGateway } from './search-gateway'
import { usePapersState } from '../papers/papers-store'

type ResultRow =
  | { type: 'paper'; id: string; title: string; detail: string }
  | { type: 'topic'; id: string; name: string; count: number }

const DEBOUNCE_MS = 300

/** 统一搜索页(M5):服务端命中纸页与箱子,失败回退本地记录。 */
export function SearchPage(): React.JSX.Element {
  const [gateway] = useState(() => createDesktopSearchGateway())
  const state = usePapersState()
  const [query, setQuery] = useState('')
  const keyword = query.trim()
  const [serverRows, setServerRows] = useState<ResultRow[] | null>(null)
  const [serverFailed, setServerFailed] = useState(false)
  const seq = useRef(0)

  useEffect(() => {
    if (!keyword) {
      return
    }
    const current = ++seq.current
    const timer = setTimeout(() => {
      void gateway
        .query({ q: keyword })
        .then((result) => {
          if (seq.current !== current) {
            return
          }
          setServerRows([
            ...result.topics.map((topic) => ({
              type: 'topic' as const,
              id: topic.id,
              name: topic.name,
              count: topic.paperCount,
            })),
            ...result.papers.items.map((paper) => ({
              type: 'paper' as const,
              id: paper.id,
              title: paper.createdAt.slice(0, 10),
              detail: paper.content,
            })),
          ])
          setServerFailed(false)
        })
        .catch(() => {
          if (seq.current === current) {
            setServerRows(null)
            setServerFailed(true)
          }
        })
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [keyword, gateway])

  const localRows = useMemo<ResultRow[]>(() => {
    const lower = keyword.toLowerCase()
    if (!lower) {
      return []
    }
    const papers = state.papers
      .filter((paper) => !paper.deletedAt && paper.content.toLowerCase().includes(lower))
      .slice(0, 10)
      .map((paper) => ({
        type: 'paper' as const,
        id: paper.id,
        title: paper.createdAt.slice(0, 10),
        detail: paper.content,
      }))
    const topics = state.topics
      .filter((topic) => topic.name.toLowerCase().includes(lower))
      .slice(0, 10)
      .map((topic) => ({
        type: 'topic' as const,
        id: topic.id,
        name: topic.name,
        count: state.papers.filter((paper) => paper.topicId === topic.id && !paper.deletedAt)
          .length,
      }))
    return [...topics, ...papers]
  }, [keyword, state])

  const showServer = Boolean(keyword) && serverRows !== null
  const rows = useMemo<ResultRow[]>(() => {
    if (showServer && serverRows) {
      const seen = new Set(
        serverRows.map((row) => (row.type === 'paper' ? `paper-${row.id}` : `topic-${row.id}`)),
      )
      return [
        ...serverRows,
        ...localRows.filter(
          (row) => !seen.has(row.type === 'paper' ? `paper-${row.id}` : `topic-${row.id}`),
        ),
      ]
    }
    return localRows
  }, [showServer, serverRows, localRows])

  return (
    <section className="study-page" aria-label="搜索纸页与箱子">
      <h2>搜索</h2>
      <div className="field">
        <label htmlFor="desktop-search-input">关键词</label>
        <input
          id="desktop-search-input"
          value={query}
          maxLength={50}
          placeholder="搜索纸页与箱子"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {serverFailed && keyword ? (
        <p role="status" style={{ fontSize: 12, opacity: 0.75 }}>
          云端搜索不可用，正在展示本机记录
        </p>
      ) : null}
      {keyword && rows.length > 0 ? (
        <ul style={{ display: 'grid', gap: 8, listStyle: 'none', padding: 0 }}>
          {rows.map((row) =>
            row.type === 'paper' ? (
              <li key={`paper-${row.id}`}>
                <Link
                  to={`/records/${row.title}`}
                  style={{ display: 'grid', gap: 2 }}
                  className="search-hit"
                >
                  <span style={{ fontSize: 12, opacity: 0.7 }}>{row.title}</span>
                  <span>{row.detail}</span>
                </Link>
              </li>
            ) : (
              <li key={`topic-${row.id}`}>
                <Link
                  to={`/boxes/${encodeURIComponent(row.id)}`}
                  style={{ display: 'grid', gap: 2 }}
                  className="search-hit"
                >
                  <span style={{ fontSize: 12, opacity: 0.7 }}>
                    {row.name} · {row.count} 张纸页 · 箱子
                  </span>
                </Link>
              </li>
            ),
          )}
        </ul>
      ) : null}
      {keyword && rows.length === 0 ? <p>没有找到相关内容。</p> : null}
      {!keyword ? <p style={{ opacity: 0.7 }}>输入关键词，找回过去的记录。</p> : null}
    </section>
  )
}
