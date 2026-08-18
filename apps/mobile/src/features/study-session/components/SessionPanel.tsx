import { memo } from 'react'
import { ScrollView, View } from 'react-native'
import type { StudySession } from '@studycommit/common/contracts'
import { AppText } from '../../../components/AppText'
import { Button } from '../../../components/Button'
import { Card } from '../../../components/Card'
import { useDialog } from '../../../components/dialog/useDialog'
import { useAppTheme } from '../../../theme/ThemeProvider'
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
import { LongSessionBanner } from './LongSessionBanner'
import { SessionStatusBadge } from './SessionStatusBadge'
import { SessionTimer } from './SessionTimer'

export function SessionPanel({
  confirmingRemote,
  onBackToStart,
  onComplete,
  onPause,
  onResume,
  pendingCommand,
  serverNow,
  session,
  topicName,
}: {
  confirmingRemote: boolean
  onBackToStart?: () => void
  onComplete: StudySessionController['complete']
  onPause: StudySessionController['pause']
  onResume: StudySessionController['resume']
  pendingCommand: SessionCommand | null
  serverNow: string | null
  session: StudySession
  topicName: string
}) {
  const theme = useAppTheme()
  const dialog = useDialog()
  const elapsed = useSessionClock(session, serverNow)
  const toggleBusy = pendingCommand === 'pause' || pendingCommand === 'resume' || confirmingRemote
  const completing = pendingCommand === 'complete'

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

  if (session.status === 'completed') {
    return (
      <ScrollView contentContainerStyle={{ gap: theme.spacing.md, padding: theme.spacing.lg }}>
        <Card>
          <View style={{ gap: theme.spacing.sm }}>
            <SessionStatusBadge status="completed" />
            <AppText variant="heading" weight="semibold">
              {topicName}
            </AppText>
            <SessionTimer value={elapsed} />
            <AppText color="muted">本次学习已结束。本阶段不会自动生成学习记录。</AppText>
            <Button onPress={onBackToStart}>返回今天</Button>
          </View>
        </Card>
      </ScrollView>
    )
  }

  const toggleLabel = session.status === 'paused' ? '继续' : '暂停'

  return (
    <ScrollView contentContainerStyle={{ gap: theme.spacing.md, padding: theme.spacing.lg }}>
      {isLongSession(session, serverNow) ? (
        <LongSessionBanner
          onComplete={showCompleteDialog}
          onContinue={() => {
            if (session.status === 'paused') {
              void onResume()
            }
          }}
          onCorrectEndTime={showCorrectEndTimeDialog}
          paused={session.status === 'paused'}
        />
      ) : null}
      <Card>
        <View style={{ gap: theme.spacing.md }}>
          <View style={{ gap: theme.spacing.xs }}>
            <AppText variant="heading" weight="semibold">
              {topicName}
            </AppText>
            <SessionStatusBadge status={session.status} />
          </View>
          {session.goal ? <AppText color="muted">{session.goal}</AppText> : null}
          <View>
            <AppText color="muted" variant="caption">
              已学习
            </AppText>
            <SessionTimer value={elapsed} />
          </View>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button
                disabled={toggleBusy}
                onPress={() => {
                  if (session.status === 'paused') {
                    void onResume()
                    return
                  }
                  void onPause()
                }}
              >
                {toggleLabel}
              </Button>
            </View>
            <View style={{ flex: 1 }}>
              <CompleteStudyButton disabled={completing} onPress={showCompleteDialog} />
            </View>
          </View>
        </View>
      </Card>
      {dialog.dialog}
    </ScrollView>
  )
}

const CompleteStudyButton = memo(function CompleteStudyButton({
  disabled,
  onPress,
}: {
  disabled: boolean
  onPress: () => void
}) {
  return (
    <Button disabled={disabled} onPress={onPress} variant="secondary">
      完成学习
    </Button>
  )
})
