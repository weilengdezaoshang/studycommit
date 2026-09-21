import { PuzzleEntry } from '../puzzle/PuzzleEntry'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { routes } from '../../app/routes'
import {
  EmptyState,
  LoadingState,
  NotebookButton,
  StateNotice,
} from '../../components/notebook/Notebook'
import { useCaptureEntry } from '../capture/use-capture-entry'
import { useStudyController } from '../study-session/StudyControllerProvider'
import { STUDY_SESSIONS_ENABLED } from '../../../../shared/feature-flags'
import { papersActions, usePapersState } from './papers-store'
import { RecordComposer } from './RecordComposer'
import { RecordsList } from './RecordsList'
import { TopicManage } from './TopicManage'
import { useRecordsView, type RecordsScope } from './use-records-view'
import './records-notebook.css'
import { NotebookSelect } from '../../components/notebook/NotebookSelect'

export type { RecordsScope } from './use-records-view'
export function RecordsHomePage({
  scope = { kind: 'all' },
  dateKey,
}: {
  scope?: RecordsScope
  dateKey?: string
}) {
  const state = usePapersState()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [compose, setCompose] = useState(false)
  const [message, setMessage] = useState('')
  const capture = useCaptureEntry()
  const study = useStudyController()
  const activeDate = dateKey || state.selectedDateKey || undefined
  const view = useRecordsView(state, scope, activeDate)
  const title =
    scope.kind === 'topic'
      ? (view.topicNames.get(scope.topicId) ?? '主题')
      : scope.kind === 'inbox'
        ? '待整理'
        : scope.kind === 'questions'
          ? '还在思考'
          : '记录本'
  const initialFailure = state.syncFailed && state.source !== 'server'
  const initialLoading = state.syncing && state.source !== 'server'
  const filtered = Boolean(activeDate || view.status !== 'all')
  const highlightId = params.get('highlight')
  const hiddenSaved =
    highlightId && !view.groups.some((day) => day.papers.some((paper) => paper.id === highlightId))
  const clear = () => {
    view.setStatus('all')
    papersActions.selectDate('')
    if (dateKey) {
      navigate(routes.timeline())
    }
  }
  return (
    <>
      <section className="records-home comic-home" aria-label={title} inert={compose || undefined}>
        <header className="comic-home__heading">
          <div>
            <h2>{title}</h2>
            <p>
              {initialFailure || initialLoading
                ? '正在连接记录本'
                : `${scope.kind === 'all' ? '全部记录 · ' : ''}${view.total} 条记录${state.nextCursor ? '（已加载）' : ''}`}
            </p>
          </div>
          <div className="notebook-actions comic-home__actions">
            <PuzzleEntry />
            <NotebookButton
              className="comic-home__manage"
              onClick={() => navigate(routes.topics())}
            >
              管理主题
            </NotebookButton>
            {STUDY_SESSIONS_ENABLED && study?.phase === 'active' && (
              <NotebookButton
                onClick={() => window.dispatchEvent(new CustomEvent('studycommit:open-study'))}
              >
                {study.session?.status === 'paused' ? '已暂停 · 继续学习' : '学习中 · 继续学习'}
              </NotebookButton>
            )}
            <NotebookButton sketch disabled={capture.busy} onClick={() => void capture.start()}>
              截图学习
            </NotebookButton>
            <NotebookButton sketch variant="primary" onClick={() => setCompose(true)}>
              ＋ 记一点
            </NotebookButton>
          </div>
        </header>
        <div className="comic-home__filters" aria-label="筛选与排序">
          {activeDate && <NotebookButton onClick={clear}>{activeDate} × 清除日期</NotebookButton>}
          <label>
            记录状态
            <NotebookSelect
              aria-label="记录状态"
              value={view.status}
              onValueChange={(value) => view.setStatus(value as typeof view.status)}
            >
              <option value="all">全部状态</option>
              <option value="open">还在思考</option>
              <option value="resolved">已经弄懂</option>
            </NotebookSelect>
          </label>
          <label>
            时间顺序
            <NotebookSelect
              aria-label="时间顺序"
              value={view.order}
              onValueChange={(value) => view.setOrder(value as typeof view.order)}
            >
              <option value="recent">最近在前</option>
              <option value="earliest">最早在前</option>
            </NotebookSelect>
          </label>
        </div>
        {scope.kind === 'topic' && view.topicNames.has(scope.topicId) && (
          <TopicManage topicId={scope.topicId} name={title} onNotice={setMessage} />
        )}
        {message && <StateNotice tone="info">{message}</StateNotice>}
        {capture.notice && <StateNotice tone="info">{capture.notice}</StateNotice>}
        {capture.permissionDenied && (
          <StateNotice
            tone="warning"
            actions={
              <NotebookButton onClick={() => void capture.openSettings()}>
                打开系统设置
              </NotebookButton>
            }
          >
            需要屏幕录制权限。请允许 StudyCommit，按系统提示重新打开应用后再试。
          </StateNotice>
        )}
        {state.syncFailed && !initialFailure && (
          <StateNotice
            actions={
              <NotebookButton
                disabled={state.syncing}
                onClick={() => void papersActions.loadRemote()}
              >
                重试同步
              </NotebookButton>
            }
          >
            同步失败 · 正在显示上次加载的记录
          </StateNotice>
        )}
        {hiddenSaved && !initialLoading && (
          <StateNotice
            tone="info"
            actions={<NotebookButton onClick={clear}>清除筛选查看</NotebookButton>}
          >
            已保存，但这条记录被当前范围或筛选隐藏。
            <button onClick={() => navigate(routes.paper(highlightId))}>直接查看记录</button>
          </StateNotice>
        )}
        {initialLoading ? (
          <LoadingState />
        ) : initialFailure ? (
          <EmptyState error title="记录暂时加载失败" description="请检查网络后重试。">
            <NotebookButton variant="primary" onClick={() => void papersActions.loadRemote()}>
              重新加载
            </NotebookButton>
          </EmptyState>
        ) : view.shown ? (
          <RecordsList
            groups={view.groups}
            topicNames={view.topicNames}
            highlightId={highlightId}
            onOpen={(id) => navigate(routes.paper(id))}
          />
        ) : (
          <EmptyState
            title={
              filtered
                ? '没有符合条件的记录'
                : scope.kind === 'all'
                  ? '记录本还是空的'
                  : '这里还没有记录'
            }
            description={
              state.nextCursor
                ? '已加载的记录中暂无结果，可以清除筛选或继续加载更多。'
                : filtered
                  ? '试试清除日期或状态筛选。'
                  : '记下一个想法，或从截图开始。'
            }
          >
            {filtered ? (
              <NotebookButton variant="primary" onClick={clear}>
                清除筛选
              </NotebookButton>
            ) : (
              <>
                <NotebookButton variant="primary" onClick={() => setCompose(true)}>
                  记下第一条
                </NotebookButton>
                <NotebookButton disabled={capture.busy} onClick={() => void capture.start()}>
                  截图学习
                </NotebookButton>
              </>
            )}
          </EmptyState>
        )}
        {state.moreError && <StateNotice>{state.moreError}</StateNotice>}
        {state.nextCursor && !initialFailure && (
          <NotebookButton
            disabled={state.loadingMore || state.syncing}
            onClick={() => void papersActions.loadMore()}
          >
            {state.loadingMore
              ? '正在加载更多…'
              : state.moreError
                ? '重试加载更多'
                : '加载更多记录'}
          </NotebookButton>
        )}
      </section>
      {compose && (
        <RecordComposer
          onClose={() => setCompose(false)}
          onSaved={(id) => {
            setCompose(false)
            const next = new URLSearchParams(params)
            next.set('highlight', id)
            setParams(next, { replace: true })
          }}
        />
      )}
    </>
  )
}
