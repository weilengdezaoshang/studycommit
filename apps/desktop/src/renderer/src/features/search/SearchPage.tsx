import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { useSearchResults } from '@studycommit/common/search-react'
import { searchRowKey } from '@studycommit/common/search-runtime'
import { createDesktopSearchGateway } from './search-gateway'
import { highlightKeyword } from './highlight'
import { usePapersState } from '../papers/papers-store'
import {
  EmptyState,
  LoadingState,
  NotebookButton,
  PaperPanel,
  StateNotice,
} from '../../components/notebook/Notebook'
import { SketchBorder } from '../../components/notebook/SketchBorder'
import './search-page.css'

/** 统一搜索页(M5):服务端命中纸页与箱子,失败回退本地记录;查询逻辑复用公共 Hook。 */
export function SearchPage(): React.JSX.Element {
  const [gateway] = useState(() => createDesktopSearchGateway())
  const searchInput = useRef<HTMLInputElement>(null)
  const clearSearch = () => {
    setQuery('')
    searchInput.current?.focus()
  }
  const state = usePapersState()
  const [allTopicsShown, setAllTopicsShown] = useState(false)
  const { query, setQuery, keyword, rows, showServer, serverFailed } = useSearchResults({
    gateway,
    source: state,
  })
  // R62:主题结果独立展示,默认两项,其余可展开
  const topicRows = rows.filter((row) => row.type === 'topic')
  const paperRows = rows.filter((row) => row.type === 'paper')
  const visibleTopics = allTopicsShown ? topicRows : topicRows.slice(0, 2)
  const loading = Boolean(keyword) && !showServer && !serverFailed

  return (
    <section className="study-page search-page notebook-search" aria-label="搜索纸页与箱子">
      <header className="notebook-search__header">
        <div>
          <p className="notebook-search__eyebrow">记录本 / 搜索</p>
          <h1>找回一点想法</h1>
          <p>记得一个词，就从这里翻起。</p>
        </div>
        <Link to="/timeline" className="notebook-search__back">
          返回记录本 ↗
        </Link>
      </header>
      <PaperPanel className="notebook-search__sheet">
        <div className="search-field">
          <label htmlFor="desktop-search-input" className="search-field__label">
            搜索记录
          </label>
          <div className="search-field__row">
            <SketchBorder />
            <input
              ref={searchInput}
              id="desktop-search-input"
              value={query}
              maxLength={50}
              aria-describedby="search-input-hint"
              placeholder="搜索记录、疑问或主题"
              onChange={(event) => {
                setQuery(event.target.value)
                setAllTopicsShown(false)
              }}
            />
            {keyword ? (
              <button
                type="button"
                className="search-field__clear"
                onClick={clearSearch}
                aria-label={`清除关键词 ${keyword}`}
              >
                清除
              </button>
            ) : null}
          </div>
          <div id="search-input-hint" className="notebook-search__hint">
            <span>搜索正文、疑问和主题名称</span>
            <span>{query.length === 50 ? '已达 50 字上限' : '最多 50 字'}</span>
          </div>
        </div>
      </PaperPanel>
      {serverFailed && keyword ? (
        <StateNotice tone="warning">
          云端搜索不可用，正在展示本机记录（本机只筛选正文与主题）
        </StateNotice>
      ) : null}
      {loading && <LoadingState label="正在搜索云端记录，本机结果先显示…" />}
      {keyword && topicRows.length > 0 ? (
        <>
          <h2 className="notebook-search__section-title">
            相关主题 <span>{topicRows.length}</span>
          </h2>
          <ul className="search-results search-topics">
            {visibleTopics.map((row) => (
              <li key={searchRowKey(row)} className="search-card search-card--topic">
                <SketchBorder />
                <Link to={`/boxes/${encodeURIComponent(row.id)}`} className="search-card__link">
                  <span className="search-card__meta">
                    <span className="search-card__name">{highlightKeyword(row.name, keyword)}</span>
                    <span>主题</span>
                  </span>
                  <span className="search-card__body">{row.count} 条记录 · 查看主题里的内容 ↗</span>
                </Link>
              </li>
            ))}
          </ul>
          {topicRows.length > 2 && (
            <button
              type="button"
              className="search-topics-toggle"
              aria-expanded={allTopicsShown}
              onClick={() => setAllTopicsShown((value) => !value)}
            >
              {allTopicsShown ? '收起主题' : `展开其余 ${topicRows.length - 2} 个主题`}
            </button>
          )}
        </>
      ) : null}
      {keyword && paperRows.length > 0 ? (
        <>
          <h2 className="notebook-search__section-title">
            找到的记录 <span>{paperRows.length}</span>
          </h2>
          <ul className="search-results">
            {paperRows.map((row) => (
              <li key={searchRowKey(row)} className="search-card">
                <SketchBorder />
                <Link to={`/records/${row.title}`} className="search-card__link">
                  <span className="search-card__meta">
                    <time>{row.title}</time>
                    <span>记录</span>
                  </span>
                  <span className="search-card__body">{highlightKeyword(row.detail, keyword)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {keyword && rows.length > 0 && showServer ? (
        <p className="search-note">搜索范围为记录正文、疑问和主题名称，按更新时间排列。</p>
      ) : null}
      {keyword && rows.length === 0 && !loading ? (
        <EmptyState
          title={serverFailed ? '本机暂时没有找到' : '这次还没翻到'}
          description={`没有找到与「${keyword}」相关的内容。试试更短的关键词，或换个说法。`}
        >
          <NotebookButton sketch onClick={clearSearch}>
            清除关键词
          </NotebookButton>
        </EmptyState>
      ) : null}
      {!keyword ? (
        <div className="notebook-search__intro">
          <span className="notebook-search__bookmark" aria-hidden="true">
            记
          </span>
          <div>
            <h2>从一个关键词开始</h2>
            <p>
              某段记下的话、还没想通的问题，
              <br />
              或一个主题的名字，都可以试着找找。
            </p>
            <Link to="/timeline">没有想好搜什么？先翻翻记录 →</Link>
          </div>
        </div>
      ) : null}
    </section>
  )
}
