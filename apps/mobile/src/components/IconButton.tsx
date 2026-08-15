import type { ComponentProps } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Pressable, type PressableProps } from 'react-native'
import { useAppTheme } from '../theme/ThemeProvider'

type IconName = ComponentProps<typeof Ionicons>['name']

export type IconButtonProps = Omit<PressableProps, 'children' | 'accessibilityLabel'> & {
  accessibilityLabel: string
  icon: IconName
  iconSize?: number
  variant?: 'default' | 'subtle' | 'danger'
}

export function IconButton({ accessibilityLabel, disabled, icon, iconSize, style, variant = 'default', ...props }: IconButtonProps) {
  const theme = useAppTheme()
  const palette = {
    default: { background: theme.colors.surface, foreground: theme.colors.text },
    subtle: { background: theme.colors.surfaceMuted, foreground: theme.colors.textMuted },
    danger: { background: theme.colors.dangerSurface, foreground: theme.colors.danger },
  }[variant]

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      style={(state) => [
        { alignItems: 'center', backgroundColor: palette.background, borderRadius: theme.radii.pill, justifyContent: 'center', minHeight: theme.sizes.touchTarget, minWidth: theme.sizes.touchTarget, opacity: disabled ? theme.motion.disabledOpacity : state.pressed ? theme.motion.pressedOpacity : 1 },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...props}
    >
      <Ionicons accessibilityElementsHidden color={palette.foreground} importantForAccessibility="no-hide-descendants" name={icon} size={iconSize ?? theme.sizes.iconLg} />
    </Pressable>
  )
}
