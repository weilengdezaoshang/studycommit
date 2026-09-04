import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { routes } from '../../app/routes'
import { AppIcon } from '../../components/navigation/AppIcon'
import { paperColors } from './paper-visual'
import { papersActions, usePapersState } from './papers-store'
import type { PaperWithExtra } from './view-model'
import './collections.css'
import { useOptionalDesktopServices } from '../study-session/api/DesktopServicesProvider'
import { PaperExplainPanel } from './PaperExplainPanel'

/** 请求 AppShell 打开学习抽屉(抽屉状态在 shell 层,通过事件解耦)。 */
export function requestOpenDrawer() {
  window.dispatchEvent(new CustomEvent('studycommit:open-drawer'))
}

export function RecordsListPage({
  title,
  papers,
  topicNameOf,
  emptyCopy,
  mode = 'box',
  topicId,
}: {
  title: string
  papers: PaperWithExtra[]
  topicNameOf: (paper: PaperWithExtra) => string
  emptyCopy: string
  mode?: 'box' | 'inbox' | 'questions' | 'date'
  topicId?: string
}): React.JSX.Element {
  const state = usePapersState()
  const services = useOptionalDesktopServices()
  const ai = services?.ai
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const detailId = searchParams.get('paper')
  const detailPaper = papers.find((paper) => paper.id === detailId)
  const readButton = useRef<HTMLButtonElement>(null)
  const detailHeading = useRef<HTMLHeadingElement>(null)
  const wasReading = useRef(false)
  useEffect(() => {
    if (detailPaper) {
      detailHeading.current?.focus()
    } else if (wasReading.current) {
      readButton.current?.focus({ preventScroll: true })
    }
    wasReading.current = Boolean(detailPaper)
  }, [detailPaper])
  function closeDetail() {
    const next = new URLSearchParams(searchParams)
    next.delete('paper')
    setSearchParams(next, { replace: true })
  }
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState(mode === 'questions' ? 'open' : 'all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [destination, setDestination] = useState('')
  const [message, setMessage] = useState('')
  const [showExplain, setShowExplain] = useState(false)
  const [renamingTopic, setRenamingTopic] = useState(false)
  const [topicDraftName, setTopicDraftName] = useState('')
  const [topicActionPending, setTopicActionPending] = useState(false)
  const isOpen = (paper: PaperWithExtra) =>
    paper.extra.hasQuestion && !paper.extra.isQuestionResolved
  const visible = papers
    .filter((paper) => paper.content.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .filter(
      (paper) =>
        filter === 'all' || (filter === 'open' ? isOpen(paper) : paper.extra.isQuestionResolved),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const selected = visible.find((paper) => paper.id === selectedId) ?? visible[0]
  const description =
    mode === 'inbox'
      ? '先记下来就很好。现在，给想法找一个合适的箱子。'
      : mode === 'questions'
        ? '不急着得到所有答案，从一个还想弄懂的问题开始。'
        : mode === 'date'
          ? '回到那一天，看看当时留下的想法。'
          : '每一张收好的纸页，都在慢慢成为你的理解。'
  const style = Object.fromEntries(
    Object.entries(paperColors).map(([key, value]) => [`--paper-${key}`, value]),
  ) as CSSProperties
  async function renameCurrentTopic() {
    if (!topicId || !topicDraftName.trim()) {
      return
    }
    setTopicActionPending(true)
    try {
      await papersActions.renameTopic(topicId, topicDraftName)
      setRenamingTopic(false)
      setMessage('箱子已同步')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '箱子重命名失败')
    } finally {
      setTopicActionPending(false)
    }
  }
  async function deleteCurrentTopic() {
    if (!topicId) {
      return
    }
    setTopicActionPending(true)
    try {
      await papersActions.deleteTopic(topicId)
      navigate(routes.timeline())
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '箱子删除失败')
    } finally {
      setTopicActionPending(false)
    }
  }
  const organizeControls = selected ? (
    <div className="collection-organize">
      <label htmlFor="collection-box">
        {mode === 'inbox' ? '给这张纸页找个归属' : '收纳到箱子'}
      </label>
      <div>
        <select
          id="collection-box"
          value={destination}
          onChange={(event) => setDestination(event.target.value)}
        >
          <option value="">选择箱子</option>
          {state.topics.map((topic) => (
            <option key={topic.id} value={topic.id}>
              {topic.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="collection-primary"
          disabled={!destination}
          onClick={() => {
            papersActions.organizePaper(selected.id, destination)
            setMessage(
              `纸页已归入「${state.topics.find((topic) => topic.id === destination)?.name}」`,
            )
            setDestination('')
            // 纸页归档后会离开当前列表,收起阅读区避免展示已不在列表中的纸页
            setSelectedId(null)
          }}
        >
          归入箱子
        </button>
      </div>
      {state.topics.length === 0 && (
        <button type="button" className="collection-primary" onClick={() => requestOpenDrawer()}>
          打开学习抽屉，新建一个箱子
        </button>
      )}
    </div>
  ) : null
  return (
    <>
      <section
        hidden={Boolean(detailId)}
        className={`collection collection--${mode}${selectedId && visible.some((paper) => paper.id === selectedId) ? ' has-selection' : ''}`}
        style={style}
        aria-label={title}
      >
        <Link
          to="/timeline"
          className="collection-back"
          onClick={(event) => {
            // 有浏览历史时返回来源页,直接打开 URL 时回时间线
            const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
            if (idx > 0) {
              event.preventDefault()
              navigate(-1)
            }
          }}
        >
          返回纸页
        </Link>
        <header className="collection-heading">
          <div>
            <div className="collection-title-line">
              <AppIcon
                name={
                  mode === 'inbox'
                    ? 'inbox-tray'
                    : mode === 'questions'
                      ? 'history'
                      : mode === 'date'
                        ? 'today'
                        : 'box'
                }
              />
              <h1>{title}</h1>
            </div>
            <p>{description}</p>
          </div>
          <span className="collection-count">
            {papers.length} {mode === 'questions' ? '个问题' : '张纸页'}
          </span>
        </header>
        {mode === 'box' && topicId && (
          <details className="collection-manage collection-topic-manage">
            <summary>管理这个箱子</summary>
            {renamingTopic ? (
              <form
                className="collection-rename"
                onSubmit={(event) => {
                  event.preventDefault()
                  void renameCurrentTopic()
                }}
              >
                <input
                  value={topicDraftName}
                  maxLength={18}
                  aria-label="箱子名称"
                  autoFocus
                  onChange={(event) => setTopicDraftName(event.target.value)}
                />
                <button
                  type="submit"
                  className="collection-primary"
                  disabled={!topicDraftName.trim() || topicActionPending}
                >
                  保存
                </button>
                <button
                  type="button"
                  className="collection-resolve"
                  disabled={topicActionPending}
                  onClick={() => setRenamingTopic(false)}
                >
                  取消
                </button>
              </form>
            ) : (
              <div className="collection-rename">
                <button
                  type="button"
                  className="collection-resolve"
                  disabled={topicActionPending}
                  onClick={() => {
                    setTopicDraftName(title)
                    setRenamingTopic(true)
                  }}
                >
                  重命名
                </button>
                <button
                  type="button"
                  className="collection-resolve"
                  disabled={topicActionPending}
                  onClick={() => {
                    if (window.confirm(`删除「${title}」？箱内纸页会回到待整理。`)) {
                      void deleteCurrentTopic()
                    }
                  }}
                >
                  删除箱子
                </button>
              </div>
            )}
          </details>
        )}
        <div className="collection-tools">
          <div className="collection-filters" aria-label="筛选纸页">
            {(mode === 'questions'
              ? [
                  ['open', '还在思考'],
                  ['resolved', '已经弄懂'],
                  ['all', '全部问题'],
                ]
              : [
                  ['all', '全部纸页'],
                  ['open', '还在思考'],
                ]
            ).map(([value, label]) => (
              <button
                type="button"
                key={value}
                aria-pressed={filter === value}
                onClick={() => {
                  setFilter(value)
                  setDestination('')
                }}
              >
                {label}
                <span className="collection-filter-count" aria-hidden="true">
                  {value === 'all'
                    ? papers.length
                    : papers.filter((paper) =>
                        value === 'open' ? isOpen(paper) : paper.extra.isQuestionResolved,
                      ).length}
                </span>
              </button>
            ))}
          </div>
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setDestination('')
            }}
            aria-label="搜索当前页面的纸页"
            placeholder="找一张纸页…"
          />
        </div>
        <p className="collection-feedback" role="status">
          {message ||
            `按记录时间 · 最近在前${query.trim() ? ` · 找到 ${visible.length} 张纸页` : ''}`}
        </p>
        {selected ? (
          <div className="collection-workspace">
            <nav className="collection-list" aria-label="纸页列表">
              {visible.map((paper) => (
                <button
                  key={paper.id}
                  type="button"
                  className={`collection-row${paper.id === selected.id ? ' is-selected' : ''}`}
                  aria-current={paper.id === selected.id ? 'true' : undefined}
                  onClick={() => {
                    setSelectedId(paper.id)
                    setDestination('')
                  }}
                >
                  <span className="collection-row-top">
                    <time>
                      {new Date(paper.createdAt).toLocaleDateString('zh-CN', {
                        month: 'long',
                        day: 'numeric',
                      })}
                    </time>
                    {paper.id === selected.id && (
                      <span className="collection-reading">正在阅读</span>
                    )}
                  </span>
                  <span className="collection-excerpt">{paper.content}</span>
                  <span className="collection-row-meta">
                    <span>{topicNameOf(paper)}</span>
                    <span>
                      {isOpen(paper)
                        ? '还在思考'
                        : paper.extra.isQuestionResolved
                          ? '已经弄懂'
                          : '纸页'}
                    </span>
                  </span>
                </button>
              ))}
              <p className="collection-list-end">这里的想法，随时可以再回来。</p>
            </nav>
            <article
              className={`collection-reader${isOpen(selected) ? ' has-question' : ''}`}
              key={selected.id}
            >
              <button
                type="button"
                className="collection-reader-back"
                onClick={() => setSelectedId(null)}
              >
                返回列表
              </button>
              <div className="collection-reader-preview" role="region" aria-label="正文预览">
                <header>
                  <span>{topicNameOf(selected)}</span>
                  <time>
                    {new Date(selected.createdAt).toLocaleString('zh-CN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                </header>
                {selected.extra.hasQuestion && (
                  <span className="collection-question">
                    {isOpen(selected) ? '还在思考的问题' : '这个问题，已经弄懂了'}
                  </span>
                )}
                <h2 className="collection-reader-label">当时记下的想法</h2>
                <p className="collection-body">{selected.content}</p>
              </div>
              <button
                ref={readButton}
                type="button"
                className="collection-read-full"
                onClick={() => {
                  const next = new URLSearchParams(searchParams)
                  next.set('paper', selected.id)
                  setSearchParams(next)
                }}
              >
                阅读全文
              </button>
              <footer className="collection-reader-actions">
                {mode === 'inbox' ? (
                  organizeControls
                ) : (
                  <details className="collection-manage">
                    <summary>{selected.topicId ? '调整所属箱子' : '收纳这张纸页'}</summary>
                    {organizeControls}
                  </details>
                )}
                {isOpen(selected) && (
                  <button
                    type="button"
                    className={
                      mode === 'questions'
                        ? 'collection-primary collection-resolve-primary'
                        : 'collection-resolve'
                    }
                    onClick={() => {
                      papersActions.resolveQuestion(selected.id)
                      setMessage('已标记为弄懂，原来的纸页仍然保留。')
                    }}
                  >
                    我已经弄懂了
                  </button>
                )}
                {isOpen(selected) && ai && !showExplain && (
                  <button
                    type="button"
                    className="collection-primary"
                    onClick={() => setShowExplain(true)}
                  >
                    继续弄懂
                  </button>
                )}
                {isOpen(selected) && services && showExplain && (
                  <PaperExplainPanel
                    key={selected.id}
                    paper={selected}
                    ai={services.ai}
                    onClose={() => setShowExplain(false)}
                  />
                )}
                {mode === 'questions' && selected.extra.hasQuestion && !isOpen(selected) && (
                  <button
                    type="button"
                    className="collection-resolve"
                    onClick={() => {
                      papersActions.reopenQuestion(selected.id)
                      setMessage('已改回还在思考。')
                    }}
                  >
                    改回还在思考
                  </button>
                )}
                {mode === 'questions' && (
                  <p className="collection-action-note">
                    {isOpen(selected)
                      ? '等你想清楚了，再标记为弄懂。'
                      : '理解会改变，当时的记录会一直保留。'}
                  </p>
                )}
              </footer>
            </article>
          </div>
        ) : (
          <div className="collection-empty">
            <h2>{papers.length ? '没有找到符合条件的纸页' : emptyCopy}</h2>
            <p>
              {papers.length
                ? '试试其他关键词，或查看全部纸页。'
                : mode === 'inbox'
                  ? '新想法出现时，先记下来就好。'
                  : '不必着急，留一点空白给下一次发现。'}
            </p>
            {papers.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  setFilter('all')
                }}
              >
                清除筛选
              </button>
            )}
          </div>
        )}
        <p className="collection-demo">当前为本地示例工作区，整理与问题状态仅在本次运行中保存。</p>
      </section>
      {detailId && (
        <section className="collection-detail" style={style} aria-label="记录详情">
          <button type="button" className="collection-detail-back" onClick={closeDetail}>
            返回{title}
          </button>
          {detailPaper ? (
            <article>
              <header>
                <span>{topicNameOf(detailPaper)}</span>
                <time>{new Date(detailPaper.createdAt).toLocaleString('zh-CN')}</time>
              </header>
              <h1 ref={detailHeading} tabIndex={-1}>
                记录详情
              </h1>
              {detailPaper.extra.hasQuestion && (
                <p className="collection-detail-state">
                  {isOpen(detailPaper) ? '还在思考' : '已经弄懂'}
                </p>
              )}
              <p className="collection-detail-content">{detailPaper.content}</p>
            </article>
          ) : (
            <div>
              <h1>这张纸页已不在当前列表中</h1>
              <p>返回列表，查看其他纸页。</p>
            </div>
          )}
        </section>
      )}
    </>
  )
}
