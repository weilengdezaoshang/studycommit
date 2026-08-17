import { Component, type ErrorInfo, type PropsWithChildren } from 'react'
import { StatusBar } from 'expo-status-bar'
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { appInitialWindowMetrics } from '../core/safeArea'
import { createTheme } from '../theme/theme'

type AppErrorBoundaryProps = PropsWithChildren<{
  onError?: (error: Error, info: ErrorInfo) => void
}>

type AppErrorBoundaryState = {
  hasError: boolean
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info)
  }

  private retry = () => {
    this.setState({ hasError: false })
  }

  render() {
    if (this.state.hasError) {
      return <AppCrashFallback onRetry={this.retry} />
    }

    return this.props.children
  }
}

type AppCrashFallbackProps = {
  onRetry: () => void
}

function AppCrashFallback({ onRetry }: AppCrashFallbackProps) {
  const theme = createTheme(useColorScheme())

  return (
    <SafeAreaProvider initialMetrics={appInitialWindowMetrics}>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
        <View
          accessible
          accessibilityLabel="应用暂时无法显示"
          accessibilityRole="alert"
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.lg,
            },
          ]}
        >
          <Text accessibilityRole="header" style={[styles.title, { color: theme.colors.text }]}>
            应用暂时无法显示
          </Text>
          <Text style={[styles.description, { color: theme.colors.textMuted }]}>
            你的学习数据没有被删除。请重试；如果问题持续出现，请重新启动应用。
          </Text>
          <Pressable
            accessibilityHint="重新加载 StudyCommit 界面"
            accessibilityRole="button"
            onPress={onRetry}
            style={({ pressed }) => [
              styles.button,
              {
                backgroundColor: theme.colors.primary,
                borderRadius: theme.radii.md,
                opacity: pressed ? theme.motion.pressedOpacity : 1,
              },
            ]}
          >
            <Text style={[styles.buttonText, { color: theme.colors.onPrimary }]}>重试</Text>
          </Pressable>
        </View>
        <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      </SafeAreaView>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    padding: 24,
    borderWidth: 1,
  },
  title: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600',
  },
  description: {
    marginTop: 12,
    fontSize: 16,
    lineHeight: 24,
  },
  button: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
})
