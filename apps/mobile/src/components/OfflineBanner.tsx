import Ionicons from '@expo/vector-icons/Ionicons'
import { View } from 'react-native'
import { useAppTheme } from '../theme/ThemeProvider'
import { AppText } from './AppText'

export function OfflineBanner({ pendingCount = 0 }: { pendingCount?: number }) {
  const theme = useAppTheme()
  const count = Math.max(0, pendingCount)
  return (
    <View
      accessibilityRole="alert"
      style={{
        alignItems: 'center',
        backgroundColor: theme.colors.warningSurface,
        flexDirection: 'row',
        gap: theme.spacing.sm,
        padding: theme.spacing.md,
      }}
    >
      <Ionicons
        accessibilityElementsHidden
        color={theme.colors.warning}
        importantForAccessibility="no-hide-descendants"
        name="cloud-offline-outline"
        size={theme.sizes.iconLg}
      />
      <AppText style={{ color: theme.colors.warning }} weight="medium">
        {count > 0 ? `${count} 条内容待同步` : '离线可继续使用'}
      </AppText>
    </View>
  )
}
