import { Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAppTheme } from '../../theme/ThemeProvider'
import { AppText } from '../AppText'

export function Toast({ message, onClose }: { message: string | null; onClose: () => void }) {
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
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.md,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
          },
        ]}
      >
        <AppText accessibilityRole="text" style={{ textAlign: 'center' }}>
          {message}
        </AppText>
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
    borderWidth: 1,
    maxWidth: 360,
  },
})
