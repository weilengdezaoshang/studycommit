import type { ComponentProps } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import { View } from 'react-native'
import { useAppTheme } from '../theme/ThemeProvider'
import { AppText } from './AppText'
import { Button } from './Button'

type Base = { description: string; icon?: ComponentProps<typeof Ionicons>['name']; title: string }
type Action = Base & { actionLabel: string; onAction: () => void }
type NoAction = Base & { actionLabel?: never; onAction?: never }
export type EmptyStateProps = Action | NoAction

export function EmptyState({
  description,
  icon = 'folder-open-outline',
  title,
  ...action
}: EmptyStateProps) {
  const theme = useAppTheme()
  return (
    <View style={{ alignItems: 'center', gap: theme.spacing.sm, padding: theme.spacing.lg }}>
      <Ionicons
        accessibilityElementsHidden
        color={theme.colors.textMuted}
        importantForAccessibility="no-hide-descendants"
        name={icon}
        size={theme.sizes.iconXl}
      />
      <AppText variant="heading" weight="semibold">
        {title}
      </AppText>
      <AppText color="muted" style={{ textAlign: 'center' }}>
        {description}
      </AppText>
      {action.actionLabel && action.onAction ? (
        <Button onPress={action.onAction}>{action.actionLabel}</Button>
      ) : null}
    </View>
  )
}
