import { memo, useState } from 'react'
import type { LearningLog, StudySession } from '@studycommit/common/contracts'
import { useDialog } from '../../../components/dialog/useDialog'
import { LongSessionBanner } from './LongSessionBanner'
import { SessionStatusBadge } from './SessionStatusBadge'
import { SessionTimer } from './SessionTimer'
import {
  COMPLETION_NOTE_FIELDS,
  formatLocalDateTimeValue,
  isLongSession,
  parseLocalDateTimeValue,
  trimToNull,
} from '@studycommit/common/study-session-runtime'
import {
  useSessionClock,
  type SessionCommand,
  type StudySessionController,
} from '@studycommit/common/study-session-react'

export function SessionPanel({
  session,
  serverNow,
  topicName,
  pendingCommand,
  learningLog,
  savingLog,
  onPause,
  onResume,
  onComplete,
  onUpdateLearningLog,
  onBackToStart,
}: {
  session: StudySession
  serverNow: string | null
  topicName: string
  pendingCommand: SessionCommand | null
  learningLog: LearningLog | null
  savingLog: boolean
  onPause: StudySessionController['pause']
  onResume: StudySessionController['resume']
  onComplete: StudySessionController['complete']
  onUpdateLearningLog: StudySessionController['updateLearningLog']
  onBackToStart?: () => void
}): React.JSX.Element {
  const dialog = useDialog()
  const elapsed = useSessionClock(session, serverNow)
  const toggleBusy = pendingCommand === 'pause' || pendingCommand === 'resume'
  const completing = pendingCommand === 'complete'

  if (session.status === 'completed') {
    return (
      <section className="study-page study-page--session">
        <article className="study-card">
          <div className="study-card__header">
            <p className="study-card__title">{topicName}</p>
            <SessionStatusBadge status="completed" />
          </div>
          <div className="study-card__elapsed">
            <span className="study-card__label">已学习</span>
            <SessionTimer value={elapsed} />
          </div>
          <p className="study-card__goal">本次学习已结束。可以补充收获、问题和下一步。</p>
          {learningLog ? (
            <LearningLogEditor
              key={`${learningLog.id}:${learningLog.version}`}
              learningLog={learningLog}
              saving={savingLog}
              onSave={onUpdateLearningLog}
            />
          ) : null}
          <button type="button" className="button" onClick={onBackToStart}>
            返回今天
          </button>
        </article>
        {dialog.dialog}
      </section>
    )
  }

  const toggleLabel = session.status === 'paused' ? '继续' : '暂停'

  return (
    <section className="study-page study-page--session">
      {isLongSession(session, serverNow) ? (
        <LongSessionBanner
          paused={session.status === 'paused'}
          onContinue={() => {
            if (session.status === 'paused') {
              void onResume()
            }
          }}
          onComplete={() => showCompleteDialog()}
          onCorrectEndTime={() => showCorrectEndTimeDialog()}
        />
      ) : null}
      <article className="study-card study-card--session">
        <div className="study-card__header">
          <p className="study-card__title">{topicName}</p>
          <SessionStatusBadge status={session.status} />
        </div>
        {session.goal ? <p className="study-card__goal">{session.goal}</p> : null}
        <div className="study-card__elapsed">
          <span className="study-card__label">已学习</span>
          <SessionTimer value={elapsed} />
        </div>
        <div className="study-card__actions">
          <button
            type="button"
            className="button"
            disabled={toggleBusy}
            onClick={() => {
              if (session.status === 'paused') {
                void onResume()
                return
              }
              void onPause()
            }}
          >
            {toggleLabel}
          </button>
          <CompleteStudyButton disabled={completing} onClick={() => showCompleteDialog()} />
        </div>
      </article>
      {dialog.dialog}
    </section>
  )

  function showCompleteDialog() {
    dialog.show({
      title: '结束本次学习？',
      description: `完成后计时将停止，并保存一条学习记录。预计有效时长 ${elapsed}。`,
      cancelLabel: '继续学习',
      confirmLabel: '确认完成',
      confirmBusyLabel: '正在完成',
      onConfirm: () => onComplete(),
    })
  }

  function showCorrectEndTimeDialog() {
    dialog.show({
      title: '修正结束时间',
      description: '选择真实结束时间后，将作为一次明确的结束命令提交。',
      cancelLabel: '取消',
      confirmLabel: '确认结束',
      confirmBusyLabel: '正在完成',
      field: {
        label: '结束时间',
        type: 'datetime-local',
        defaultValue: formatLocalDateTimeValue(new Date()),
        min: formatLocalDateTimeValue(new Date(session.startedAt)),
        required: true,
        helperText: '格式 YYYY-MM-DDTHH:mm，不能早于开始时间',
      },
      onConfirm: ({ fieldValue }) => {
        const endedAt = fieldValue ? parseLocalDateTimeValue(fieldValue) : null
        if (!endedAt) {
          throw new Error('结束时间无效')
        }
        return onComplete({ endedAt: endedAt.toISOString(), completionSource: 'offline_sync' })
      },
    })
  }
}

function LearningLogEditor({
  learningLog,
  saving,
  onSave,
}: {
  learningLog: LearningLog
  saving: boolean
  onSave: StudySessionController['updateLearningLog']
}): React.JSX.Element {
  const [values, setValues] = useState({
    gains: learningLog.gains ?? '',
    problems: learningLog.problems ?? '',
    nextStep: learningLog.nextStep ?? '',
  })
  const dirty = COMPLETION_NOTE_FIELDS.some(
    (field) => trimToNull(values[field.key]) !== (learningLog[field.key] ?? null),
  )

  return (
    <form
      className="study-log"
      onSubmit={(event) => {
        event.preventDefault()
        if (!dirty || saving) {
          return
        }
        void onSave({
          gains: trimToNull(values.gains),
          problems: trimToNull(values.problems),
          nextStep: trimToNull(values.nextStep),
        })
      }}
    >
      {COMPLETION_NOTE_FIELDS.map((field) => (
        <div className="field" key={field.key}>
          <label htmlFor={`log-${field.key}`}>{field.label}</label>
          <textarea
            id={`log-${field.key}`}
            value={values[field.key]}
            maxLength={field.maxLength}
            rows={3}
            disabled={saving}
            placeholder="选填"
            onChange={(event) => {
              const value = event.target.value.slice(0, field.maxLength)
              setValues((current) => ({ ...current, [field.key]: value }))
            }}
          />
          <span className="field__hint">
            {values[field.key].trim() ? `${values[field.key].length}/${field.maxLength}` : '选填'}
          </span>
        </div>
      ))}
      <div className="study-form__actions">
        <button type="submit" className="button" disabled={!dirty || saving}>
          {saving ? '正在保存' : '保存学习记录'}
        </button>
      </div>
    </form>
  )
}

const CompleteStudyButton = memo(function CompleteStudyButton({
  disabled,
  onClick,
}: {
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="button button--secondary"
      disabled={disabled}
      onClick={onClick}
    >
      完成学习
    </button>
  )
})
