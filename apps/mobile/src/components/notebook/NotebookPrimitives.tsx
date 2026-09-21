import type { PropsWithChildren } from 'react'
import { StyleSheet, View, Text, type ViewStyle } from 'react-native'
import {
  spacing,
  radii,
  typography,
  studyCommitMistBlueColors as c,
} from '@studycommit/design-tokens'
import { Button, type ButtonProps } from '../Button'
import { IconButton } from '../IconButton'
import { paperTypography } from '../../theme/paper-typography'

export function NotebookButton(props: ButtonProps) {
  return <Button {...props} appearance="notebook" />
}
export function NotebookSheet({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return (
    <View style={[s.sheet, style]}>
      {children}
      <View pointerEvents="none" style={s.fold} />
    </View>
  )
}
export function NotebookHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={s.header}>
      <IconButton icon="chevron-back" accessibilityLabel="返回" onPress={onBack} />
      <Text numberOfLines={1} accessibilityRole="header" style={s.title}>
        {title}
      </Text>
      <View style={s.capsule} />
    </View>
  )
}
export function NotebookNotice({ children }: PropsWithChildren) {
  return (
    <View accessibilityLiveRegion="polite" style={s.notice}>
      <Text style={s.text}>{children}</Text>
    </View>
  )
}
const s = StyleSheet.create({
  sheet: {
    backgroundColor: c.paper,
    borderWidth: 1,
    borderColor: c.action,
    borderTopLeftRadius: radii.md,
    borderTopRightRadius: radii.sm,
    borderBottomLeftRadius: radii.sm,
    borderBottomRightRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
    overflow: 'hidden',
  },
  fold: {
    position: 'absolute',
    right: -9,
    bottom: -9,
    width: 22,
    height: 22,
    transform: [{ rotate: '45deg' }],
    borderLeftWidth: 1,
    borderColor: c.action,
    backgroundColor: c.canvas,
  },
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 56, gap: spacing.sm },
  title: { ...typography.subheading, ...paperTypography.heading, flex: 1, color: c.ink },
  capsule: { width: 96 },
  notice: { backgroundColor: c.actionSurface, borderRadius: radii.sm, padding: spacing.smPlus },
  text: { ...typography.bodySmall, color: c.action },
})
