import { ActivityIndicator, View } from 'react-native'
import { useAppTheme } from '../theme/ThemeProvider'
import { AppText } from './AppText'

export function LoadingState({ label }: { label: string }) {
  const theme = useAppTheme()
  return (
    <View
      accessible
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      style={{ alignItems: 'center', gap: theme.spacing.sm, padding: theme.spacing.lg }}
    >
      <ActivityIndicator color={theme.colors.primary} />
      <AppText color="muted">{label}</AppText>
    </View>
  )
}
