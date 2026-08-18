import { memo } from 'react'
import type { StudySession } from '@studycommit/common/contracts'
import { useDialog } from '../../../components/dialog/useDialog'
import { LongSessionBanner } from './LongSessionBanner'
import { SessionStatusBadge } from './SessionStatusBadge'
import { SessionTimer } from './SessionTimer'
import {
  formatLocalDateTimeValue,
  isLongSession,
  parseLocalDateTimeValue,
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
  confirmingRemote,
  onPause,
  onResume,
  onComplete,
  onBackToStart,
}: {
  session: StudySession
  serverNow: string | null
  topicName: string
  pendingCommand: SessionCommand | null
  confirmingRemote: boolean
  onPause: StudySessionController['pause']
  onResume: StudySessionController['resume']
  onComplete: StudySessionController['complete']
  onBackToStart?: () => void
}): React.JSX.Element {
  const dialog = useDialog()
  const elapsed = useSessionClock(session, serverNow)
  const toggleBusy = pendingCommand === 'pause' || pendingCommand === 'resume' || confirmingRemote
  const completing = pendingCommand === 'complete'

  if (session.status === 'completed') {
    return (
      <section className="study-page">
        <article className="study-card">
          <SessionStatusBadge status="completed" />
          <p className="study-card__title">{topicName}</p>
          <SessionTimer value={elapsed} />
          <p>本次学习已结束。本阶段不会自动生成学习记录。</p>
          <button type="button" className="button" onClick={onBackToStart}>
            返回今天
          </button>
        </article>
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
      description: `完成后计时将停止，本阶段不会自动生成学习记录。预计有效时长 ${elapsed}。`,
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
