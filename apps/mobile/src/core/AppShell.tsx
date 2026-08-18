import { StatusBar } from 'expo-status-bar'
import { useStudySessionController } from '@studycommit/common/study-session-react'
import { subscribeAppForeground } from '../infrastructure/lifecycle/app-foreground'
import { AppNavigator } from '../navigation/AppNavigator'
import { useAppTheme } from '../theme/ThemeProvider'
import { useMobileServices } from './MobileServicesProvider'

export function AppShell() {
  const theme = useAppTheme()
  const { studySessions, topics } = useMobileServices()
  const study = useStudySessionController({
    studySessions,
    topics,
    subscribeForeground: subscribeAppForeground,
    enablePoll: process.env.JEST_WORKER_ID === undefined,
  })

  return (
    <>
      <AppNavigator study={study} />
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
    </>
  )
}
