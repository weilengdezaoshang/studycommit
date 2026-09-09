import { memo } from 'react'
import type { LearningLog, StudySession } from '@studycommit/common/contracts'
import { useDialog } from '../../../components/dialog/useDialog'
import { LongSessionBanner } from './LongSessionBanner'
import { SessionStatusBadge } from './SessionStatusBadge'
import { SessionTimer } from './SessionTimer'
import { StudyCompanionScene } from '../../companion/StudyCompanionScene'
import { FragmentComposer } from './FragmentComposer'
import {
  COMPLETION_NOTE_FIELDS,
  formatLocalDateTimeValue,
  isLongSession,
  parseLocalDateTimeValue,
  trimToNull,
} from '@studycommit/common/study-session-runtime'
import {
  PAPER_CONTENT_MAX_LENGTH,
  PAPER_QUESTION_MAX_LENGTH,
} from '@studycommit/common/paper-runtime'
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
  onCompletePaper,
  onOpenMiniWindow,
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
  /** 会话从纸页问题起步时,收尾走 complete-paper 回写理解(BE-309) */
  onCompletePaper?: (input: {
    understandingText: string
    nextQuestionText?: string
  }) => Promise<void>
  onOpenMiniWindow?: () => void
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
          {/* R71:暂停与小窗为次级操作;片段输入突出;收尾放在底部 */}
          <div className="study-card__actions study-card__actions--secondary">
            <button
              type="button"
              className="button button--secondary"
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
            {onOpenMiniWindow ? (
              <button
                type="button"
                className="button button--secondary"
                onClick={onOpenMiniWindow}
                aria-label="在学习小窗中继续"
              >
                小窗
              </button>
            ) : null}
          </div>
          <FragmentComposer sessionId={session.id} />
          <div className="study-card__footer">
            <CompleteStudyButton disabled={completing} onClick={() => showCompleteDialog()} />
          </div>
        </article>
      </div>
      {dialog.dialog}
    </section>
  )

  function showCompleteDialog() {
    if (session.paperId && onCompletePaper) {
      showCompletePaperDialog()
      return
    }
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

  function showCompletePaperDialog() {
    dialog.show({
      title: '完成学习 · 回写理解',
      description: '写下这次弄懂了什么；也可留下下一个问题，生成新的纸页继续。',
      cancelLabel: '继续学习',
      confirmLabel: '完成并回写',
      confirmBusyLabel: '正在回写',
      notes: [
        {
          key: 'understanding',
          label: '这次弄懂了什么（必填）',
          placeholder: '用一两句话写下这次的理解',
          maxLength: PAPER_CONTENT_MAX_LENGTH,
        },
        {
          key: 'nextQuestion',
          label: '下一个问题（可选，将生成新纸页继续）',
          placeholder: '把还没弄懂的部分写成新问题',
          maxLength: PAPER_QUESTION_MAX_LENGTH,
        },
      ],
      onConfirm: async ({ notes }) => {
        const understandingText = notes.understanding?.trim() ?? ''
        if (!understandingText) {
          throw new Error('请先写下这次弄懂了什么')
        }
        await onCompletePaper?.({
          understandingText,
          nextQuestionText: notes.nextQuestion?.trim() || undefined,
        })
      },
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
