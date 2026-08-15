import type { ComponentProps, ReactNode } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { useAppTheme } from '../theme/ThemeProvider'
import { AppText } from './AppText'

type IoniconsName = ComponentProps<typeof Ionicons>['name']

export type ButtonProps = Omit<PressableProps, 'children'> & {
  children: string
  icon?: IoniconsName
  loading?: boolean
  size?: 'medium' | 'large'
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
}

export function Button({
  children,
  disabled = false,
  icon,
  loading = false,
  size = 'medium',
  style,
  variant = 'primary',
  ...props
}: ButtonProps) {
  const theme = useAppTheme()
  const inactive = disabled || loading
  const palette = {
    primary: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary, color: theme.colors.onPrimary },
    secondary: { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong, color: theme.colors.text },
    ghost: { backgroundColor: 'transparent', borderColor: 'transparent', color: theme.colors.primary },
    danger: { backgroundColor: theme.colors.danger, borderColor: theme.colors.danger, color: theme.colors.onDanger },
  }[variant]

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, ...(loading ? { busy: true } : {}) }}
      disabled={inactive}
      style={(state) => [
        styles.base,
        {
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
          minHeight: size === 'large' ? 56 : theme.sizes.controlHeight,
          opacity: inactive
            ? theme.motion.disabledOpacity
            : state.pressed
              ? theme.motion.pressedOpacity
              : 1,
          paddingHorizontal: size === 'large' ? theme.spacing.lg : theme.spacing.md,
        },
        resolveStyle(style, state),
      ]}
      {...props}
    >
      <View pointerEvents="none" style={styles.content}>
        {loading ? (
          <ActivityIndicator
            accessibilityRole="progressbar"
            color={palette.color}
            size="small"
            testID="button-loading-indicator"
          />
        ) : icon ? (
          <Ionicons
            accessibilityElementsHidden
            color={palette.color}
            importantForAccessibility="no-hide-descendants"
            name={icon}
            size={theme.sizes.iconMd}
          />
        ) : null}
        <AppText color="default" style={{ color: palette.color }} weight="semibold">
          {children}
        </AppText>
      </View>
    </Pressable>
  )
}

function resolveStyle(
  style: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>),
  state: { pressed: boolean },
): StyleProp<ViewStyle> {
  return typeof style === 'function' ? style(state) : style
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
})
