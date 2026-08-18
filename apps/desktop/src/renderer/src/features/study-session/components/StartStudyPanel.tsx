import { useEffect, useReducer, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { routes } from '../../../app/routes'
import { useDesktopServices } from '../api/DesktopServicesProvider'
import type { StudySessionController } from '../hooks/useStudySessionController'
import { initialStartStudyState, startStudyReducer } from '../state/start-study.reducer'
import { toUiError, type UiError } from '../state/ui-error'

const GOAL_MAX = 500

export function StartStudyPanel({
  study,
  onCancel,
}: {
  study: Pick<StudySessionController, 'create'>
  onCancel: () => void
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
    if (state.status === 'submitting' || !topicId) {
      return
    }
    const idempotencyKey =
      (state.status === 'error' && state.idempotencyKey) ||
      pendingKey.current ||
      crypto.randomUUID()
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

  return (
    <section className="study-page">
      <form className="study-form" onSubmit={(event) => void submit(event)}>
        <div className="field">
          <label htmlFor="start-topic">专题</label>
          <select
            id="start-topic"
            value={topicId}
            onChange={(event) => setTopicId(event.target.value)}
            required
            disabled={submitting}
          >
            <option value="">请选择专题</option>
            {state.topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.name}
              </option>
            ))}
          </select>
          {!topicId ? <span className="field__hint">请选择一个专题后再开始。</span> : null}
        </div>
        <div className="field">
          <label htmlFor="start-goal">学习目标</label>
          <textarea
            id="start-goal"
            value={goal}
            maxLength={GOAL_MAX}
            rows={4}
            disabled={submitting}
            onChange={(event) => setGoal(event.target.value)}
            placeholder="可选，最多 500 字"
          />
          <span className="field__hint">
            {goal.length}/{GOAL_MAX}
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
          <button type="submit" className="button" disabled={submitting || !topicId}>
            {submitting ? '正在开始' : '开始学习'}
          </button>
        </div>
      </form>
    </section>
  )
}
