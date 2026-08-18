import { useEffect, useReducer, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { routes } from '../../../app/routes'
import { Select } from '../../../components/select/Select'
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

export function StartStudyPanel({
  onCancel,
  study,
}: {
  onCancel: () => void
  study: Pick<StudySessionController, 'create'>
}): React.JSX.Element {
  const { topics } = useDesktopServices()
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
        <Link className="button" to={routes.topics()}>
          前往专题
        </Link>
      </section>
    )
  }

  const submitting = state.status === 'submitting'
  const formError = state.status === 'error' ? state.error : null
  const readyToStart = canStartStudy(topicId, goal)

  return (
    <section className="study-page">
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
