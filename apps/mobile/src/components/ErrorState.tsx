import Ionicons from '@expo/vector-icons/Ionicons'
import { View } from 'react-native'
import { useAppTheme } from '../theme/ThemeProvider'
import { AppText } from './AppText'
import { Button } from './Button'

export type ErrorStateProps = {
  description: string
  onRetry?: () => void
  retrying?: boolean
  title: string
}

export function ErrorState({ description, onRetry, retrying, title }: ErrorStateProps) {
  const theme = useAppTheme()
  return (
    <View
      accessible
      accessibilityRole="alert"
      style={{
        alignItems: 'center',
        backgroundColor: theme.colors.dangerSurface,
        borderRadius: theme.radii.md,
        gap: theme.spacing.sm,
        padding: theme.spacing.lg,
      }}
    >
      <Ionicons
        accessibilityElementsHidden
        color={theme.colors.danger}
        importantForAccessibility="no-hide-descendants"
        name="alert-circle-outline"
        size={theme.sizes.iconXl}
      />
      <AppText variant="heading" weight="semibold">
        {title}
      </AppText>
      <AppText color="muted" style={{ textAlign: 'center' }}>
        {description}
      </AppText>
      {onRetry ? (
        <Button loading={retrying} onPress={onRetry} variant="secondary">
          重试
        </Button>
      ) : null}
    </View>
  )
}
