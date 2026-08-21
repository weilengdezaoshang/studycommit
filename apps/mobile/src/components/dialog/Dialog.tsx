import type { PropsWithChildren } from 'react'
import { Modal, Pressable, StyleSheet, View } from 'react-native'
import { useAppTheme } from '../../theme/ThemeProvider'
import { AppText } from '../AppText'

export function Dialog({
  busy = false,
  children,
  onClose,
  onDismiss,
  open,
  title,
}: PropsWithChildren<{
  busy?: boolean
  onClose: () => void
  onDismiss?: () => void
  open: boolean
  title: string
}>) {
  const theme = useAppTheme()
  return (
    <Modal
      accessibilityViewIsModal
      animationType="fade"
      onDismiss={onDismiss}
      onRequestClose={() => {
        if (!busy) {
          onClose()
        }
      }}
      transparent
      visible={open}
    >
      <View style={[styles.overlay, { backgroundColor: theme.colors.scrim }]}>
        <Pressable
          accessibilityLabel="关闭对话框"
          accessibilityRole="button"
          disabled={busy}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityLabel={title}
          accessibilityRole="summary"
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.lg,
              gap: theme.spacing.md,
              padding: theme.spacing.lg,
            },
          ]}
        >
          <AppText variant="heading" weight="semibold">
            {title}
          </AppText>
          {children}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    borderWidth: 1,
    maxWidth: 420,
    width: '100%',
    zIndex: 1,
  },
})
