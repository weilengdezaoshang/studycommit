import { View } from 'react-native'
import { AppText } from '../../../components/AppText'
import { Button } from '../../../components/Button'
import { useAppTheme } from '../../../theme/ThemeProvider'

export function LongSessionBanner({
  onComplete,
  onContinue,
  onCorrectEndTime,
  paused,
}: {
  onComplete: () => void
  onContinue: () => void
  onCorrectEndTime: () => void
  paused: boolean
}) {
  const theme = useAppTheme()
  return (
    <View
      accessibilityRole="summary"
      style={{
        backgroundColor: theme.colors.warningSurface,
        borderRadius: theme.radii.md,
        gap: theme.spacing.sm,
        padding: theme.spacing.md,
      }}
    >
      <AppText weight="medium">本次学习已持续较长时间，仍在学习吗？</AppText>
      <View style={{ gap: theme.spacing.sm }}>
        <Button onPress={onContinue}>{paused ? '继续学习' : '仍在学习'}</Button>
        <Button onPress={onComplete} variant="secondary">
          结束学习
        </Button>
        <Button onPress={onCorrectEndTime} variant="ghost">
          修正结束时间
        </Button>
      </View>
    </View>
  )
}
