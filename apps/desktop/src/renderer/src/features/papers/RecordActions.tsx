import { NotebookSelect } from '../../components/notebook/NotebookSelect'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  NotebookButton,
  PaperPanel,
  QuestionBadge,
  StateNotice,
} from '../../components/notebook/Notebook'
import { routes } from '../../app/routes'
import { papersActions, type DesktopTopic } from './papers-store'
import { isOpenQuestion, type PaperWithExtra } from './view-model'

/** 整理命令独立于阅读器；成功才更改记录，失败保留选择并允许重试。 */
export function RecordActions({
  paper,
  topics,
  onNotice,
}: {
  paper: PaperWithExtra
  topics: DesktopTopic[]
  onNotice: (message: string) => void
}) {
  const navigate = useNavigate()
  const [destination, setDestination] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const run = async (operation: () => Promise<void>) => {
    if (lock.current) {
      return
    }
    lock.current = true
    setBusy(true)
    setError('')
    try {
      await operation()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '更新失败，请重试。')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  const changeStatus = (status: 'thinking' | 'resolved') =>
    run(async () => {
      const result = await papersActions.updateQuestionStatus(paper.id, status)
      if (!result) {
        throw new Error('状态更新失败，请重试。')
      }
      onNotice(result === status ? '记录状态已更新' : '另一台设备已修改这条记录，已读取最新状态。')
    })
  return (
    <PaperPanel title="整理这条记录" className="record-organization">
      <div className="reader-actions">
        <label>
          所属主题
          <NotebookSelect
            aria-label="所属主题"
            value={destination}
            disabled={busy}
            onValueChange={setDestination}
          >
            <option value="">
              {topics.find((topic) => topic.id === paper.topicId)?.name ?? '选择主题'}
            </option>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.name}
              </option>
            ))}
          </NotebookSelect>
        </label>
        <NotebookButton
          disabled={!destination || busy}
          onClick={() =>
            void run(async () => {
              if (!(await papersActions.organizePaper(paper.id, destination))) {
                throw new Error('归入主题失败，请检查主题是否仍存在后重试。')
              }
              onNotice('记录已归入主题')
              setDestination('')
            })
          }
        >
          {busy ? '正在更新…' : '归入主题 →'}
        </NotebookButton>
        {!topics.length && <p>暂无主题，可先到主题管理中新建。</p>}
        <h4>当前状态</h4>
        <div>
          {paper.questionStatus === 'none' && !paper.extra.hasQuestion ? (
            '未留下疑问'
          ) : (
            <QuestionBadge resolved={!isOpenQuestion(paper)} />
          )}
        </div>
        {error && <StateNotice>{error}</StateNotice>}
        {isOpenQuestion(paper) ? (
          <>
            <NotebookButton
              variant="primary"
              disabled={busy}
              onClick={() => navigate(`${routes.paper(paper.id)}/explain`)}
            >
              继续弄懂 →
            </NotebookButton>
            <NotebookButton disabled={busy} onClick={() => void changeStatus('resolved')}>
              我已经弄懂了
            </NotebookButton>
          </>
        ) : (
          paper.extra.isQuestionResolved && (
            <NotebookButton disabled={busy} onClick={() => void changeStatus('thinking')}>
              改回还在思考
            </NotebookButton>
          )
        )}
      </div>
    </PaperPanel>
  )
}
