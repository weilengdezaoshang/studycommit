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
    <section className="study-page search-page" aria-label="搜索纸页与箱子">
      <h2>搜索</h2>
      <div className="field search-field">
        <label htmlFor="desktop-search-input" className="search-field__label">
          关键词
        </label>
        <div className="search-field__row">
          <input
            id="desktop-search-input"
            value={query}
            maxLength={50}
            placeholder="搜索记录、疑问或主题"
            onChange={(event) => setQuery(event.target.value)}
          />
          {keyword ? (
            <button
              type="button"
              className="search-field__clear"
              onClick={() => setQuery('')}
              aria-label={`清除关键词 ${keyword}`}
            >
              清除
            </button>
          ) : null}
        </div>
      </div>
      {serverFailed && keyword ? (
        <p className="search-note" role="status">
          云端搜索不可用，正在展示本机记录（本机只筛选正文与主题）
        </p>
      ) : null}
      {keyword && rows.length > 0 ? (
        <ul className="search-results">
          {rows.map((row) =>
            row.type === 'paper' ? (
              <li key={`paper-${row.id}`} className="search-card">
                <Link to={`/records/${row.title}`} className="search-card__link">
                  <span className="search-card__meta">
                    <time>{row.title}</time>
                    <span>记录</span>
                  </span>
                  <span className="search-card__body">{row.detail}</span>
                </Link>
              </li>
            ) : (
              <li key={`topic-${row.id}`} className="search-card search-card--topic">
                <Link to={`/boxes/${encodeURIComponent(row.id)}`} className="search-card__link">
                  <span className="search-card__meta">
                    <span className="search-card__name">{row.name}</span>
                    <span>箱子</span>
                  </span>
                  <span className="search-card__body">
                    {row.count} 张纸页 · 进入后查看这个箱子里的记录
                  </span>
                </Link>
              </li>
            ),
          )}
        </ul>
      ) : null}
      {keyword && rows.length > 0 && showServer ? (
        <p className="search-note">搜索范围为记录正文、疑问和主题名称，按更新时间排列。</p>
      ) : null}
      {keyword && rows.length === 0 ? (
        <div className="search-empty">
          <p>没有找到与「{keyword}」相关的内容。</p>
          <button type="button" onClick={() => setQuery('')}>
            清除关键词
          </button>
        </div>
      ) : null}
      {!keyword ? (
        <p className="search-note">输入关键词，找回过去的记录。搜索范围：记录正文、疑问、主题。</p>
      ) : null}
    </section>
  )
}
