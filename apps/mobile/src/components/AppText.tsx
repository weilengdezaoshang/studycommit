import type { TextProps } from 'react-native'
import { Text } from 'react-native'
import { useAppTheme } from '../theme/ThemeProvider'
import type { typography } from '../theme/tokens'

export type TextVariant = keyof typeof typography

export type AppTextProps = TextProps & {
  color?: 'default' | 'muted' | 'danger' | 'success'
  variant?: TextVariant
  weight?: 'regular' | 'medium' | 'semibold'
}

const weights = {
  regular: '400',
  medium: '500',
  semibold: '600',
} as const

export function AppText({
  accessibilityRole,
  color = 'default',
  style,
  variant = 'body',
  weight = 'regular',
  ...props
}: AppTextProps) {
  const theme = useAppTheme()
  const colorToken = {
    default: theme.colors.text,
    muted: theme.colors.textMuted,
    danger: theme.colors.danger,
    success: theme.colors.success,
  }[color]
  const inferredRole = variant === 'title' || variant === 'heading' ? 'header' : undefined

  return (
    <Text
      accessibilityRole={accessibilityRole ?? inferredRole}
      style={[theme.typography[variant], { color: colorToken, fontWeight: weights[weight] }, style]}
      {...props}
    />
  )
}
