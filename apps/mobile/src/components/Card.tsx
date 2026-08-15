import type { PropsWithChildren } from 'react'
import { Pressable, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import { useAppTheme } from '../theme/ThemeProvider'

type Common = PropsWithChildren<{ padding?: 'none' | 'small' | 'medium' | 'large'; style?: StyleProp<ViewStyle>; variant?: 'default' | 'muted' | 'outlined' }>
type StaticCard = Common & { accessibilityLabel?: never; onPress?: never }
type InteractiveCard = Common & { accessibilityLabel: string; onPress: NonNullable<PressableProps['onPress']> }
export type CardProps = StaticCard | InteractiveCard

export function Card(props: CardProps) {
  const theme = useAppTheme()
  const { children, padding = 'medium', style, variant = 'default' } = props
  const base = {
    backgroundColor: variant === 'muted' ? theme.colors.surfaceMuted : variant === 'outlined' ? 'transparent' : theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    padding: { none: 0, small: theme.spacing.sm, medium: theme.spacing.md, large: theme.spacing.lg }[padding],
  }

  if ('onPress' in props && props.onPress) {
    return <Pressable accessibilityLabel={props.accessibilityLabel} accessibilityRole="button" onPress={props.onPress} style={(state) => [base, { opacity: state.pressed ? theme.motion.pressedOpacity : 1 }, style]}>{children}</Pressable>
  }
  return <View style={[base, style]}>{children}</View>
}
