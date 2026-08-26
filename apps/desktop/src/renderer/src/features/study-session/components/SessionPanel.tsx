import { memo } from 'react'
import type { LearningLog, StudySession } from '@studycommit/common/contracts'
import { useDialog } from '../../../components/dialog/useDialog'
import { LongSessionBanner } from './LongSessionBanner'
import { SessionStatusBadge } from './SessionStatusBadge'
import { SessionTimer } from './SessionTimer'
import { StudyCompanionScene } from '../../companion/StudyCompanionScene'
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
  onPause,
  onResume,
  onComplete,
  onBackToStart,
}: {
  session: StudySession
  serverNow: string | null
  topicName: string
  pendingCommand: SessionCommand | null
  learningLog: LearningLog | null
  onPause: StudySessionController['pause']
  onResume: StudySessionController['resume']
  onComplete: StudySessionController['complete']
  onBackToStart?: () => void
}): React.JSX.Element {
  const dialog = useDialog()
  const elapsed = useSessionClock(session, serverNow)
  const toggleBusy = pendingCommand === 'pause' || pendingCommand === 'resume'
  const completing = pendingCommand === 'complete'

  if (session.status === 'completed') {
    return (
      <section className="study-page study-page--session">
        <StudyCompanionScene state="completed" />
        <article className="study-card">
          <div className="study-card__header">
            <p className="study-card__title">{topicName}</p>
            <SessionStatusBadge status="completed" />
          </div>
          <div className="study-card__elapsed">
            <span className="study-card__label">已学习</span>
            <SessionTimer value={elapsed} />
          </div>
          <p className="study-card__goal">本次学习已完成，学习记录已保存。</p>
          {learningLog ? <LearningLogSummary learningLog={learningLog} /> : null}
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
      <div className="study-session-layout">
        <StudyCompanionScene state={session.status === 'paused' ? 'paused' : 'focusing'} />
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
      </div>
      {dialog.dialog}
    </section>
  )

  function showCompleteDialog() {
    dialog.show({
      title: '完成本次学习',
      description: `计时将停止并保存学习记录。预计有效时长 ${elapsed}。以下内容均可选填。`,
      cancelLabel: '继续学习',
      confirmLabel: '完成并保存',
      confirmBusyLabel: '正在保存',
      notes: COMPLETION_NOTE_FIELDS,
      onConfirm: ({ notes }) =>
        onComplete({
          gains: trimToNull(notes.gains),
          problems: trimToNull(notes.problems),
          nextStep: trimToNull(notes.nextStep),
        }),
    })
  }

  function showCorrectEndTimeDialog() {
    dialog.show({
      title: '修正结束时间',
      description: '选择真实结束时间后，将作为一次明确的结束命令提交。',
      cancelLabel: '取消',
      confirmLabel: '完成并保存',
      confirmBusyLabel: '正在保存',
      notes: COMPLETION_NOTE_FIELDS,
      field: {
        label: '结束时间',
        type: 'datetime-local',
        defaultValue: formatLocalDateTimeValue(new Date()),
        min: formatLocalDateTimeValue(new Date(session.startedAt)),
        required: true,
        helperText: '格式 YYYY-MM-DDTHH:mm，不能早于开始时间',
      },
      onConfirm: ({ fieldValue, notes }) => {
        const endedAt = fieldValue ? parseLocalDateTimeValue(fieldValue) : null
        if (!endedAt) {
          throw new Error('结束时间无效')
        }
        return onComplete({
          endedAt: endedAt.toISOString(),
          completionSource: 'offline_sync',
          gains: trimToNull(notes.gains),
          problems: trimToNull(notes.problems),
          nextStep: trimToNull(notes.nextStep),
        })
      },
    })
  }
}

function LearningLogSummary({ learningLog }: { learningLog: LearningLog }): React.JSX.Element {
  return (
    <div className="study-log study-log--summary">
      {COMPLETION_NOTE_FIELDS.map((field) => (
        <div className="field" key={field.key}>
          <span className="field__label">{field.label}</span>
          <p>{learningLog[field.key] ?? '未填写'}</p>
        </div>
      ))}
    </div>
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
