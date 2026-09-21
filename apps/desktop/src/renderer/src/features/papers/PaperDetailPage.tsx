import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import {
  EmptyState,
  LoadingState,
  NotebookButton,
  StateNotice,
} from '../../components/notebook/Notebook'
import { PaperExplainPanel } from './PaperExplainPanel'
import { useDesktopServices } from '../study-session/api/DesktopServicesProvider'
import { papersActions, usePapersState } from './papers-store'
import { paperWithExtra } from './view-model'
import { RecordReader } from './RecordReader'
import { routes } from '../../app/routes'

export function PaperDetailPage({ explain = false }: { explain?: boolean }) {
  const { ai } = useDesktopServices()
  const { paperId } = useParams()
  const navigate = useNavigate()
  const state = usePapersState()
  const [notice, setNotice] = useState('')
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<{
    id?: string
    revision?: number
    state: 'loading' | 'ready' | 'missing' | 'error' | 'forbidden'
  }>({ state: 'loading' })
  const paper = state.papers.find((item) => item.id === paperId && !item.deletedAt)
  useEffect(() => {
    let active = true
    if (!paperId) {
      return
    }
    void papersActions
      .ensureDetail(paperId)
      .then((value) => {
        if (active) {
          setResult({ id: paperId, revision, state: value ? 'ready' : 'missing' })
        }
      })
      .catch((error: unknown) => {
        const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
        const status =
          error && typeof error === 'object' && 'status' in error ? Number(error.status) : 0
        if (active) {
          setResult({
            id: paperId,
            revision,
            state:
              status === 404 || /NOT_FOUND/.test(code)
                ? 'missing'
                : status === 403 || status === 401 || /FORBIDDEN|UNAUTHORIZED/.test(code)
                  ? 'forbidden'
                  : 'error',
          })
        }
      })
    return () => {
      active = false
    }
  }, [paperId, revision])
  const status = !paperId
    ? 'missing'
    : result.id === paperId && result.revision === revision
      ? result.state
      : 'loading'
  const back = () => navigate(routes.timeline())
  return (
    <section className="secondary-page secondary-detail">
      <p>
        <Link to={routes.timeline()}>← 返回记录本</Link>
      </p>
      {status === 'loading' ? (
        <LoadingState />
      ) : status === 'missing' || status === 'forbidden' || (status === 'ready' && !paper) ? (
        <EmptyState
          error
          title={status === 'forbidden' ? '无法访问这条记录' : '这条记录已不存在'}
          description={
            status === 'forbidden'
              ? '请确认登录状态与访问权限。'
              : '可能已被删除，返回记录本查看其他内容。'
          }
        >
          <NotebookButton onClick={back}>返回记录本</NotebookButton>
        </EmptyState>
      ) : (
        <>
          {status === 'error' && (
            <StateNotice
              actions={
                <NotebookButton onClick={() => setRevision((n) => n + 1)}>重新加载</NotebookButton>
              }
            >
              记录暂时加载失败，请检查网络后重试。{paper && '下方为已加载的内容。'}
            </StateNotice>
          )}
          {paper &&
            (explain ? (
              <PaperExplainPanel
                key={paper.id}
                paper={paperWithExtra(state, paper)}
                ai={ai}
                onClose={back}
              />
            ) : (
              <RecordReader
                key={paper.id}
                fullPage
                paper={paperWithExtra(state, paper)}
                topicName={
                  state.topics.find((topic) => topic.id === paper.topicId)?.name ?? '待整理'
                }
                topics={state.topics}
                onClose={back}
                onNotice={setNotice}
              />
            ))}
        </>
      )}
      {notice && <StateNotice tone="info">{notice}</StateNotice>}
    </section>
  )
}
