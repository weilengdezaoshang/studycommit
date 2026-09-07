import { useEffect, useReducer, useRef, useState, type FormEvent } from 'react'
import { Select } from '../../../components/select/Select'
import { openCaptureConfirm } from '../../capture/confirm-store'
import { useDesktopServices } from '../api/DesktopServicesProvider'
import type { StudySessionController } from '@studycommit/common/study-session-react'
import {
  canStartStudy,
  createIdempotencyKey,
  initialStartStudyState,
  startStudyReducer,
  toUiError,
  type UiError,
} from '@studycommit/common/study-session-runtime'

const GOAL_MAX = 500

/** 截图学习入口状态(DE-310):权限拒绝时展示解释与系统设置跳转。 */
function useCaptureEntry() {
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [permissionDenied, setPermissionDenied] = useState(false)

  const start = async () => {
    if (busy) {
      return
    }
    setBusy(true)
    setNotice(null)
    try {
      const permission = await window.studyCommit.capture.permissionCheck()
      if (!(permission.ok && (permission.data === 'granted' || permission.data === 'not-needed'))) {
        setPermissionDenied(true)
        return
      }
      const result = await window.studyCommit.capture.request()
      if (!result.ok) {
        setNotice('截图失败，请重试')
        return
      }
      if (result.data.status === 'completed') {
        // 截图完成:打开问题确认页(DE-311)
        openCaptureConfirm(result.data.captureId)
      } else if (result.data.status === 'permission-denied') {
        setPermissionDenied(true)
      } else if (result.data.status === 'failed') {
        setNotice(`截图失败：${result.data.message}`)
      }
      // cancelled:用户主动取消,静默
    } finally {
      setBusy(false)
    }
  }

  return { busy, notice, permissionDenied, start }
}

export function StartStudyPanel({
  onCancel,
  study,
}: {
  onCancel: () => void
  study: Pick<StudySessionController, 'create'>
}): React.JSX.Element {
  const { topics } = useDesktopServices()
  const captureEntry = useCaptureEntry()
  const [state, dispatch] = useReducer(startStudyReducer, initialStartStudyState)
  const [topicId, setTopicId] = useState('')
  const [goal, setGoal] = useState('')
  const pendingKey = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    dispatch({ type: 'topics-started' })
    void topics.listActive().then(
      (page) => {
        if (!cancelled) {
          dispatch({ type: 'topics-succeeded', topics: page.items })
        }
      },
      (error) => {
        if (!cancelled) {
          dispatch({ type: 'topics-failed', error: toUiError(error) })
        }
      },
    )
    return () => {
      cancelled = true
    }
  }, [topics])

  async function submit(event?: FormEvent) {
    event?.preventDefault()
    if (state.status === 'submitting' || !canStartStudy(topicId, goal)) {
      return
    }
    const idempotencyKey =
      (state.status === 'error' && state.idempotencyKey) ||
      pendingKey.current ||
      createIdempotencyKey()
    pendingKey.current = idempotencyKey
    dispatch({ type: 'submit-started', idempotencyKey })
    try {
      const selected = 'topics' in state ? state.topics.find((topic) => topic.id === topicId) : null
      await study.create({
        topicId,
        goal: goal.trim() || null,
        idempotencyKey,
        topicName: selected?.name,
      })
      pendingKey.current = null
    } catch (error) {
      dispatch({ type: 'submit-failed', error: error as UiError })
    }
  }

  if (state.status === 'loading-topics') {
    return (
      <section className="study-page" aria-busy="true">
        <p>正在加载可学习专题</p>
      </section>
    )
  }

  if (state.status === 'empty-topics') {
    return (
      <section className="study-page">
        <h2>还没有可学习的专题</h2>
        <p>开始学习前需要至少一个未归档专题。</p>
      </section>
    )
  }

  const submitting = state.status === 'submitting'
  const formError = state.status === 'error' ? state.error : null
  const readyToStart = canStartStudy(topicId, goal)

  return (
    <section className="study-page">
      {captureEntry.permissionDenied ? (
        <div className="study-alert" role="alert">
          <p>需要屏幕录制权限才能截图学习。</p>
          <p>在系统设置中允许 StudyCommit 录制屏幕后，回到这里重试。</p>
          <button
            type="button"
            className="button button--secondary"
            onClick={() => void window.studyCommit.capture.openPermissionSettings()}
          >
            打开系统设置
          </button>
        </div>
      ) : null}
      <div className="study-form__actions" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className="button button--secondary"
          onClick={() => void captureEntry.start()}
          disabled={captureEntry.busy}
        >
          {captureEntry.busy ? '正在截图…' : '截图学习'}
          <span aria-hidden="true" style={{ marginLeft: 8, opacity: 0.7 }}>
            ⇧⌘A
          </span>
        </button>
        {captureEntry.notice ? (
          <span style={{ alignSelf: 'center', fontSize: 13, opacity: 0.8 }} role="status">
            {captureEntry.notice}
          </span>
        ) : null}
      </div>
      <form className="study-form" onSubmit={(event) => void submit(event)}>
        <Select
          disabled={submitting}
          hint={topicId ? undefined : '请选择一个专题后再开始。'}
          id="start-topic"
          label="专题"
          onChange={(event) => setTopicId(event.target.value)}
          placeholder="请选择专题"
          required
          value={topicId}
        >
          {state.topics.map((topic) => (
            <option key={topic.id} value={topic.id}>
              {topic.name}
            </option>
          ))}
        </Select>
        <div className="field">
          <label htmlFor="start-goal">学习目标</label>
          <textarea
            id="start-goal"
            value={goal}
            maxLength={GOAL_MAX}
            rows={4}
            disabled={submitting}
            onChange={(event) => setGoal(event.target.value)}
            placeholder="请填写学习目标，最多 500 字"
            required
          />
          <span className="field__hint">
            {goal.trim() ? `${goal.length}/${GOAL_MAX}` : '请填写学习目标后再开始。'}
          </span>
        </div>
        {formError ? (
          <p className="study-alert" role="alert">
            {formError.message}
            {formError.requestId ? `（${formError.requestId}）` : ''}
          </p>
        ) : null}
        <div className="study-form__actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={onCancel}
            disabled={submitting}
          >
            取消
          </button>
          <button type="submit" className="button" disabled={submitting || !readyToStart}>
            {submitting ? '正在开始' : '开始学习'}
          </button>
        </div>
      </form>
    </section>
  )
}
