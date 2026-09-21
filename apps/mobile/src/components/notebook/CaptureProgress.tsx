import { Image, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import {
  spacing,
  radii,
  typography,
  studyCommitMistBlueColors as c,
} from '@studycommit/design-tokens'
import { captureStatusLabels, type CaptureImage } from '@studycommit/common/capture-runtime'
import peekingCat from '../../../assets/notebook/peeking-cat.png'
import { paperTypography } from '../../theme/paper-typography'
import { CapturePhoto } from './CapturePhoto'
import { NotebookButton, NotebookSheet } from './NotebookPrimitives'

export function CaptureProgress({
  images,
  title,
  onRetry,
}: {
  images: CaptureImage[]
  title: string
  onRetry: (id: string) => void
}) {
  const completed = images.filter((i) => i.status === 'done').length
  const current = images.findIndex((i) => i.status === 'working')
  return (
    <>
      <View style={s.hero}>
        <Text accessibilityRole="header" style={s.heading}>
          {title}
        </Text>
        <View style={s.underline} />
        <View style={s.intro}>
          <View style={s.copy}>
            <Text style={s.text}>
              {current >= 0 ? `正在识别第 ${current + 1} 张` : '图片和已识别文字都会保留'}
            </Text>
            <Text style={s.hint}>完成后可编辑文字</Text>
          </View>
          <Image source={peekingCat} style={s.cat} accessible={false} />
        </View>
      </View>
      <NotebookSheet>
        {images.map((item, index) => (
          <View key={item.id} style={[s.task, index > 0 && s.divider]}>
            <CapturePhoto uri={item.uri} style={s.thumbnail} />
            <View style={s.status}>
              <Ionicons
                name={
                  item.status === 'done'
                    ? 'checkmark'
                    : item.status === 'working'
                      ? 'pencil-outline'
                      : item.status === 'failed'
                        ? 'alert-outline'
                        : 'hourglass-outline'
                }
                size={24}
                color={c.action}
              />
            </View>
            <View style={s.copy}>
              <Text style={s.text}>第 {index + 1} 张</Text>
              <Text style={s.hint}>{captureStatusLabels[item.status]}</Text>
            </View>
            {item.status === 'failed' && (
              <NotebookButton variant="secondary" onPress={() => onRetry(item.id)}>
                重试
              </NotebookButton>
            )}
          </View>
        ))}
        <Text accessibilityLiveRegion="polite" style={s.text}>
          已完成 {completed} / {images.length} 张
        </Text>
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: images.length, now: completed }}
          style={s.track}
        >
          <View
            style={[s.bar, { width: `${images.length ? (completed / images.length) * 100 : 0}%` }]}
          />
        </View>
      </NotebookSheet>
    </>
  )
}
const s = StyleSheet.create({
  hero: { paddingTop: spacing.md },
  heading: { ...typography.title, ...paperTypography.heading, color: c.ink },
  underline: {
    height: 5,
    backgroundColor: c.actionSurfaceStrong,
    borderRadius: radii.pill,
    marginTop: spacing.xs,
    width: '88%',
    transform: [{ rotate: '-1deg' }],
  },
  intro: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg },
  copy: { flex: 1, gap: spacing.xs },
  text: { ...typography.body, color: c.ink },
  hint: { ...typography.bodySmall, color: c.muted },
  cat: { width: 114, height: 88, resizeMode: 'contain', marginBottom: -spacing.sm },
  task: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  divider: { borderTopWidth: 1, borderColor: c.line },
  thumbnail: { width: 72, height: 80, borderRadius: radii.sm },
  status: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: c.action,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.actionSurface,
  },
  track: {
    height: 16,
    borderWidth: 1,
    borderColor: c.action,
    borderRadius: radii.pill,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  bar: { height: '100%', backgroundColor: c.actionSurfaceStrong, borderRadius: radii.pill },
})
