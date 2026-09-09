import { useState } from 'react'
import { Link } from 'react-router'
import { useSearchResults } from '@studycommit/common/search-react'
import { searchRowKey } from '@studycommit/common/search-runtime'
import { createDesktopSearchGateway } from './search-gateway'
import { highlightKeyword } from './highlight'
import { usePapersState } from '../papers/papers-store'

/** 统一搜索页(M5):服务端命中纸页与箱子,失败回退本地记录;查询逻辑复用公共 Hook。 */
export function SearchPage(): React.JSX.Element {
  const [gateway] = useState(() => createDesktopSearchGateway())
  const state = usePapersState()
  const { query, setQuery, keyword, rows, showServer, serverFailed } = useSearchResults({
    gateway,
    source: state,
  })

  return (
    <section className="study-page search-page" aria-label="搜索纸页与箱子">
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
              <li key={searchRowKey(row)} className="search-card">
                <Link to={`/records/${row.title}`} className="search-card__link">
                  <span className="search-card__meta">
                    <time>{row.title}</time>
                    <span>记录</span>
                  </span>
                  <span className="search-card__body">{highlightKeyword(row.detail, keyword)}</span>
                </Link>
              </li>
            ) : (
              <li key={searchRowKey(row)} className="search-card search-card--topic">
                <Link to={`/boxes/${encodeURIComponent(row.id)}`} className="search-card__link">
                  <span className="search-card__meta">
                    <span className="search-card__name">{highlightKeyword(row.name, keyword)}</span>
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
