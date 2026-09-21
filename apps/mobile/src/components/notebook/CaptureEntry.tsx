import { useState } from 'react'
import { Modal, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { spacing, studyCommitMistBlueColors as c } from '@studycommit/design-tokens'
import { IconButton } from '../IconButton'
export function CaptureEntry({ onSelect }: { onSelect: (mode: 'text' | 'ocr' | 'image') => void }) {
  const [open, setOpen] = useState(false)
  const insets = useSafeAreaInsets()
  const button = (
    <IconButton
      icon={open ? 'close' : 'add'}
      accessibilityLabel={open ? '关闭创建菜单' : '新建记录'}
      onPress={() => setOpen(!open)}
      style={s.button}
    />
  )
  return (
    <>
      <View style={[s.anchor, { bottom: insets.bottom + spacing.lg }]}>{button}</View>
      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={s.scrim}
          accessibilityLabel="关闭创建菜单"
          onPress={() => setOpen(false)}
        />
        <View accessibilityViewIsModal style={[s.anchor, { bottom: insets.bottom + spacing.lg }]}>
          {(['text', 'ocr', 'image'] as const).map((mode, i) => (
            <IconButton
              key={mode}
              icon={(['pencil-outline', 'scan-outline', 'image-outline'] as const)[i]}
              accessibilityLabel={['文字记录', '识别文字', '图片记录'][i]}
              style={[
                s.button,
                s.action,
                [
                  { bottom: 208, right: 12 },
                  { bottom: 142, right: 92 },
                  { bottom: 64, right: 150 },
                ][i],
              ]}
              onPress={() => {
                setOpen(false)
                onSelect(mode)
              }}
            />
          ))}
          {button}
        </View>
      </Modal>
    </>
  )
}
const s = StyleSheet.create({
  anchor: { position: 'absolute', right: spacing.lg },
  button: {
    width: 58,
    height: 58,
    backgroundColor: c.actionSurface,
    borderWidth: 1.5,
    borderColor: c.action,
    borderTopRightRadius: 25,
  },
  action: { position: 'absolute' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: c.scrim },
})
