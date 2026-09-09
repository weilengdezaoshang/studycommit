import { useState } from 'react'
import { papersActions, type DesktopTopic } from './papers-store'
import { isOpenQuestion, type PaperWithExtra } from './view-model'
import { PaperExplainPanel } from './PaperExplainPanel'
import { useOptionalDesktopServices } from '../study-session/api/DesktopServicesProvider'

/**
 * V7 阅读栏(R58/R61):阅读与思考;理解以浅蓝区块展示,
 * 归档/问题状态/AI 解释收在「整理与更多」;操作结果经 onNotice 提示宿主。
 */
export function RecordReader({
  paper,
  topicName,
  topics,
  headingRef,
  closeButtonRef,
  onClose,
  onNotice,
}: {
  paper: PaperWithExtra
  topicName: string
  topics: DesktopTopic[]
  /** 打开时聚焦的阅读栏标题 */
  headingRef?: React.Ref<HTMLHeadingElement>
  /** 关闭后焦点还原的按钮 */
  closeButtonRef?: React.RefObject<HTMLButtonElement | null>
  onClose: () => void
  onNotice: (message: string) => void
}): React.JSX.Element {
  const services = useOptionalDesktopServices()
  const ai = services?.ai
  const [destination, setDestination] = useState('')
  const [showExplain, setShowExplain] = useState(false)
  const open = isOpenQuestion(paper)

  async function runQuestionCommand(status: 'thinking' | 'resolved') {
    const result = await papersActions.updateQuestionStatus(paper.id, status)
    if (result === status) {
      onNotice(status === 'resolved' ? '已标记为弄懂，原来的纸页仍然保留。' : '已改回还在思考。')
    } else if (result !== null) {
      onNotice('另一台设备已更改这张纸页，已为你展示最新状态。')
    } else {
      onNotice('暂时没能更新问题状态，请稍后再试。')
    }
  }

  return (
    <aside className="record-reader" aria-label="阅读与思考">
      <header className="record-reader__bar">
        <h2 ref={headingRef} tabIndex={-1}>
          阅读与思考
        </h2>
        <button
          ref={closeButtonRef}
          type="button"
          className="record-reader__close"
          aria-label="关闭阅读栏"
          onClick={onClose}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </header>
      <div className="record-reader__scroll" key={paper.id}>
        <p className="record-reader__meta">
          {Number(paper.createdAt.slice(5, 7))} 月 {Number(paper.createdAt.slice(8, 10))} 日 ·{' '}
          {topicName}
        </p>
        <h3 className="record-reader__label">当时留下的</h3>
        <p className="record-reader__body">{paper.content}</p>
        {paper.understandingText && (
          <div className="record-reader__understanding">
            <h4>后来我想到</h4>
            <p>{paper.understandingText}</p>
          </div>
        )}
        <details className="record-reader__more">
          <summary>整理与更多</summary>
          <div className="record-reader__organize">
            <label htmlFor="record-reader-topic">
              {paper.status === 'inbox' ? '给这张纸页找个归属' : '收纳到主题'}
            </label>
            <div>
              <select
                id="record-reader-topic"
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
              >
                <option value="">选择主题</option>
                {topics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="records-home__compose"
                disabled={!destination}
                onClick={() => {
                  papersActions.organizePaper(paper.id, destination)
                  onNotice(
                    `纸页已归入「${topics.find((topic) => topic.id === destination)?.name}」`,
                  )
                  setDestination('')
                }}
              >
                归入主题
              </button>
            </div>
            {open && (
              <button
                type="button"
                className="record-reader__text-action"
                onClick={() => void runQuestionCommand('resolved')}
              >
                我已经弄懂了
              </button>
            )}
            {!open && paper.extra.isQuestionResolved && (
              <button
                type="button"
                className="record-reader__text-action"
                onClick={() => void runQuestionCommand('thinking')}
              >
                改回还在思考
              </button>
            )}
            {open && ai && !showExplain && (
              <button
                type="button"
                className="record-reader__text-action"
                onClick={() => setShowExplain(true)}
              >
                继续弄懂
              </button>
            )}
            {open && services && showExplain && (
              <PaperExplainPanel
                paper={paper}
                ai={services.ai}
                onClose={() => setShowExplain(false)}
              />
            )}
          </div>
        </details>
      </div>
    </aside>
  )
}
