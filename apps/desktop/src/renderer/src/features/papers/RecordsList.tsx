import { useLayoutEffect, useRef, useState } from 'react'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { NotebookButton, PaperPanel, QuestionBadge } from '../../components/notebook/Notebook'
import { isOpenQuestion, type PaperWithExtra } from './view-model'
import { SketchBorder } from '../../components/notebook/SketchBorder'
import { CalendarDateCard } from '../../components/notebook/CalendarDateCard'

export interface RecordDay {
  dateKey: string
  papers: PaperWithExtra[]
}

function RecordCard({
  paper,
  topic,
  onOpen,
  highlighted,
}: {
  paper: PaperWithExtra
  topic: string
  onOpen: (id: string) => void
  highlighted: boolean
}) {
  const lines = paper.content.trim().split('\n').filter(Boolean)
  const title = lines[0] || `图片记录 · ${paper.assets?.length ?? 0} 张`
  return (
    <article
      className={`comic-record${highlighted ? ' comic-record--highlighted' : ''}`}
      data-record-id={paper.id}
    >
      <SketchBorder />
      <time dateTime={paper.createdAt}>
        {new Date(paper.createdAt).toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </time>
      <button
        className="comic-record__open"
        onClick={() => onOpen(paper.id)}
        title={title}
        aria-label={`打开记录：${title.slice(0, 80)}`}
      >
        <strong>{title}</strong>
        {lines.length > 1 && <span>{lines.slice(1).join('\n')}</span>}
      </button>
      <footer>
        <span className="comic-record__topic" title={topic}>
          # {topic}
        </span>
        {isOpenQuestion(paper) ? (
          <QuestionBadge />
        ) : paper.extra.isQuestionResolved ? (
          <QuestionBadge resolved />
        ) : null}
        {paper.understandingText && (
          <button className="comic-record__understanding" onClick={() => onOpen(paper.id)}>
            查看理解 →
          </button>
        )}
      </footer>
    </article>
  )
}

/** 每天是一个虚拟项，内部最多逐批展示六条；分镜不破坏数据顺序。 */
export function RecordsList({
  groups,
  topicNames,
  onOpen,
  highlightId,
}: {
  groups: RecordDay[]
  topicNames: Map<string, string>
  onOpen: (id: string) => void
  highlightId: string | null
}) {
  const [expanded, setExpanded] = useState<Record<string, number>>({})
  const list = useRef<HTMLDivElement>(null)
  const [margin, setMargin] = useState(0)
  useLayoutEffect(() => {
    const measure = () =>
      setMargin(list.current ? list.current.getBoundingClientRect().top + window.scrollY : 0)
    measure()
    const observer = new ResizeObserver(measure)
    if (list.current?.parentElement) {
      observer.observe(list.current.parentElement)
    }
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])
  const virtual = useWindowVirtualizer({
    count: groups.length,
    estimateSize: () => 460,
    overscan: 3,
    scrollMargin: margin,
    getItemKey: (index) => groups[index].dateKey,
  })
  const highlightIndex = groups.findIndex((day) =>
    day.papers.some((paper) => paper.id === highlightId),
  )
  useLayoutEffect(() => {
    if (highlightIndex >= 0) {
      virtual.scrollToIndex(highlightIndex, { align: 'start' })
    }
  }, [highlightId, highlightIndex, virtual])
  return (
    <div
      ref={list}
      className="comic-days"
      style={{ height: virtual.getTotalSize(), position: 'relative' }}
    >
      {virtual.getVirtualItems().map((item) => {
        const day = groups[item.index]
        const highlightAt = day.papers.findIndex((paper) => paper.id === highlightId)
        const count = Math.max(expanded[day.dateKey] ?? 6, highlightAt + 1)
        const shown = day.papers.slice(0, count)
        const date = new Date(`${day.dateKey}T12:00:00`)
        return (
          <div
            key={item.key}
            ref={virtual.measureElement}
            data-index={item.index}
            className="comic-day-position"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${item.start - margin}px)`,
            }}
          >
            <PaperPanel className="comic-day" aria-label={date.toLocaleDateString('zh-CN')}>
              <CalendarDateCard dateKey={day.dateKey} count={day.papers.length} />
              <div className={`comic-day__frames comic-day__frames--${Math.min(shown.length, 3)}`}>
                {shown.map((paper) => (
                  <RecordCard
                    key={paper.id}
                    paper={paper}
                    topic={topicNames.get(paper.topicId ?? '') ?? '待整理'}
                    onOpen={onOpen}
                    highlighted={paper.id === highlightId}
                  />
                ))}
              </div>
              {day.papers.length > 6 && (
                <div className="comic-day__more">
                  <NotebookButton
                    onClick={() =>
                      setExpanded((value) => ({
                        ...value,
                        [day.dateKey]: count >= day.papers.length ? 6 : count + 6,
                      }))
                    }
                  >
                    {count >= day.papers.length
                      ? '收起这一天的记录'
                      : `展开其余 ${day.papers.length - shown.length} 条`}
                  </NotebookButton>
                </div>
              )}
            </PaperPanel>
          </div>
        )
      })}
    </div>
  )
}
