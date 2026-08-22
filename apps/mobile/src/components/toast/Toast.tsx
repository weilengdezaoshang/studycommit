import Ionicons from '@expo/vector-icons/Ionicons'
import { Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAppTheme } from '../../theme/ThemeProvider'
import { AppText } from '../AppText'

export function Toast({
  message,
  onClose,
  type = 'default',
}: {
  message: string | null
  onClose: () => void
  type?: 'default' | 'error'
}) {
  const theme = useAppTheme()
  const insets = useSafeAreaInsets()
  if (!message) {
    return null
  }
  return (
    <View pointerEvents="box-none" style={[styles.layer, { top: insets.top + theme.spacing.xxxl }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="关闭提示"
        onPress={onClose}
        style={[
          styles.toast,
          {
            backgroundColor: type === 'error' ? theme.colors.dangerSurface : theme.colors.surface,
            borderColor: type === 'error' ? theme.colors.danger : theme.colors.border,
            borderRadius: theme.radii.md,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
          },
        ]}
      >
        <View style={styles.content}>
          {type === 'error' ? (
            <Ionicons
              accessibilityElementsHidden
              color={theme.colors.danger}
              importantForAccessibility="no-hide-descendants"
              name="alert-circle-outline"
              size={theme.sizes.iconMd}
            />
          ) : null}
          <AppText
            accessibilityRole="text"
            color={type === 'error' ? 'danger' : 'default'}
            style={styles.message}
            weight={type === 'error' ? 'medium' : 'regular'}
          >
            {message}
          </AppText>
        </View>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  layer: {
    alignItems: 'center',
    left: 24,
    position: 'absolute',
    right: 24,
    zIndex: 40,
  },
  toast: {
    alignItems: 'center',
    borderWidth: 1,
    maxWidth: 360,
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  message: {
    flexShrink: 1,
    textAlign: 'center',
  },
})
