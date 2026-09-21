import { CapturePhoto } from './CapturePhoto'
import { ScrollView, Pressable, StyleSheet, Text, View } from 'react-native'
import { radii, spacing, studyCommitMistBlueColors as c } from '@studycommit/design-tokens'
import type { CaptureImage } from '@studycommit/common/capture-runtime'
import { IconButton } from '../IconButton'
export function CaptureImageStrip({
  images,
  selected,
  onSelect,
  onRemove,
}: {
  images: CaptureImage[]
  selected: number
  onSelect: (index: number) => void
  onRemove?: (id: string) => void
}) {
  return (
    <ScrollView horizontal contentContainerStyle={s.strip} showsHorizontalScrollIndicator={false}>
      {images.map((item, index) => (
        <View key={item.id}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`第 ${index + 1} 张${item.missing ? '，图片失效' : ''}`}
            accessibilityState={{ selected: selected === index }}
            onPress={() => onSelect(index)}
            style={[s.thumb, selected === index && s.selected]}
          >
            {item.uri ? <CapturePhoto uri={item.uri} style={s.image} /> : <Text>图片失效</Text>}
            <Text style={s.badge}>{index + 1}</Text>
          </Pressable>
          {onRemove && (
            <IconButton
              icon="close"
              iconSize={16}
              accessibilityLabel={`移除第 ${index + 1} 张`}
              onPress={() => onRemove(item.id)}
              style={s.remove}
            />
          )}
        </View>
      ))}
    </ScrollView>
  )
}
const s = StyleSheet.create({
  strip: { gap: spacing.smPlus, paddingVertical: spacing.sm },
  thumb: {
    width: 96,
    height: 104,
    borderWidth: 1,
    borderColor: c.lineStrong,
    borderRadius: radii.sm,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  selected: { borderColor: c.action, borderWidth: 2 },
  image: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    paddingHorizontal: spacing.sm,
    color: c.ink,
    backgroundColor: c.actionSurface,
  },
  remove: {
    position: 'absolute',
    top: -spacing.sm,
    right: -spacing.xs,
    backgroundColor: 'transparent',
    alignSelf: 'flex-end',
    minHeight: 48,
    minWidth: 48,
  },
})
