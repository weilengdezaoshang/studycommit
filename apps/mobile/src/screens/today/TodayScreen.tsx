import { useCallback, useState } from 'react'
import { BackHandler, View } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { AppText } from '../../components/AppText'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { SessionPanel } from '../../features/study-session/components/SessionPanel'
import { StartStudyPanel } from '../../features/study-session/components/StartStudyPanel'
import type { StudySessionController } from '@studycommit/common/study-session-react'
import { useAppTheme } from '../../theme/ThemeProvider'

export function TodayScreen({ study }: { study: StudySessionController }) {
  const theme = useAppTheme()
  const navigation = useNavigation()
  const [starting, setStarting] = useState(false)
  if ((study.phase === 'active' || study.phase === 'completed') && starting) {
    setStarting(false)
  }

  useFocusEffect(
    useCallback(() => {
      if (!starting) {
        return undefined
      }
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        setStarting(false)
        return true
      })
      return () => {
        subscription.remove()
      }
    }, [starting]),
  )

  if (study.phase === 'loading') {
    return <LoadingState label="正在读取当前学习会话" />
  }

  if (study.phase === 'error') {
    return (
      <View style={{ padding: theme.spacing.lg }}>
        <ErrorState
          description={
            study.error?.requestId
              ? `${study.error.message} 请求 ${study.error.requestId}`
              : (study.error?.message ?? '无法读取当前学习')
          }
          onRetry={study.reload}
          title="无法读取当前学习"
        />
      </View>
    )
  }

  if ((study.phase === 'active' || study.phase === 'completed') && study.session) {
    return (
      <SessionPanel
        confirmingRemote={study.confirmingRemote}
        onBackToStart={study.reload}
        onComplete={study.complete}
        onPause={study.pause}
        onResume={study.resume}
        pendingCommand={study.pendingCommand}
        serverNow={study.serverNow}
        session={study.session}
        topicName={study.topicName}
      />
    )
  }

  if (starting) {
    return (
      <StartStudyPanel
        onCancel={() => setStarting(false)}
        onGoToTopics={() => navigation.getParent()?.navigate('TopicsTab')}
        study={study}
      />
    )
  }

  return (
    <View style={{ padding: theme.spacing.lg }}>
      <Card>
        <View style={{ gap: theme.spacing.md }}>
          <AppText color="muted" variant="caption">
            当前学习
          </AppText>
          <AppText variant="heading" weight="semibold">
            今天，从一次专注开始
          </AppText>
          <AppText color="muted">选择专题后开始学习。关闭应用不会结束进行中的会话。</AppText>
          <Button onPress={() => setStarting(true)}>开始学习</Button>
        </View>
      </Card>
    </View>
  )
}
