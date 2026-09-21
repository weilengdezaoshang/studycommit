import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native'
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator'
import type { CaptureImage } from '@studycommit/common/capture-runtime'
import { studyCommitMistBlueColors as c } from '@studycommit/design-tokens'
import { NotebookButton, NotebookSheet } from '../../components/notebook/NotebookPrimitives'

type Rect = { x: number; y: number; width: number; height: number }
type Size = { width: number; height: number }
const MIN_EDGE = 48

function contained(image: Size, stage: Size): Rect {
  if (!image.width || !image.height || !stage.width || !stage.height) {
    return { x: 0, y: 0, ...stage }
  }
  const scale = Math.min(stage.width / image.width, stage.height / image.height)
  const width = image.width * scale
  const height = image.height * scale
  return { x: (stage.width - width) / 2, y: (stage.height - height) / 2, width, height }
}

function CropHandle({
  corner,
  crop,
  bounds,
  onChange,
}: {
  corner: 'tl' | 'tr' | 'bl' | 'br'
  crop: Rect
  bounds: Rect
  onChange: (next: Rect) => void
}) {
  const startRef = useRef(crop)
  /* eslint-disable react-hooks/refs -- PanResponder 只在手势回调中读写该 ref。 */
  const responder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startRef.current = crop
      },
      onPanResponderMove: (_, gesture) => {
        const start = startRef.current
        const left = corner.includes('l')
          ? Math.min(start.x + start.width - MIN_EDGE, Math.max(bounds.x, start.x + gesture.dx))
          : start.x
        const top = corner.includes('t')
          ? Math.min(start.y + start.height - MIN_EDGE, Math.max(bounds.y, start.y + gesture.dy))
          : start.y
        const right = corner.includes('r')
          ? Math.max(
              start.x + MIN_EDGE,
              Math.min(bounds.x + bounds.width, start.x + start.width + gesture.dx),
            )
          : start.x + start.width
        const bottom = corner.includes('b')
          ? Math.max(
              start.y + MIN_EDGE,
              Math.min(bounds.y + bounds.height, start.y + start.height + gesture.dy),
            )
          : start.y + start.height
        onChange({ x: left, y: top, width: right - left, height: bottom - top })
      },
    })
  }, [bounds, corner, crop, onChange])
  /* eslint-enable react-hooks/refs */
  const left = corner.includes('l') ? crop.x - 15 : crop.x + crop.width - 15
  const top = corner.includes('t') ? crop.y - 15 : crop.y + crop.height - 15
  return <View {...responder.panHandlers} style={[s.handle, { left, top }]} />
}

export function CaptureCropEditor({
  image,
  onCancel,
  onComplete,
  onError,
}: {
  image: CaptureImage | null
  onCancel: () => void
  onComplete: (result: { uri: string; width: number; height: number }) => void
  onError: () => void
}) {
  const [stage, setStage] = useState<Size>({ width: 0, height: 0 })
  const bounds = useMemo(
    () => contained({ width: image?.width ?? 1, height: image?.height ?? 1 }, stage),
    [image?.height, image?.width, stage],
  )
  const [crop, setCrop] = useState<Rect>(bounds)
  const [working, setWorking] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setCrop(bounds))
    return () => cancelAnimationFrame(frame)
  }, [bounds, image?.id])
  const layout = (event: LayoutChangeEvent) => setStage(event.nativeEvent.layout)
  const confirm = async () => {
    if (!image?.width || !image.height || !bounds.width || working) {
      return
    }
    setWorking(true)
    try {
      const scaleX = image.width / bounds.width
      const scaleY = image.height / bounds.height
      const originX = Math.max(0, Math.round((crop.x - bounds.x) * scaleX))
      const originY = Math.max(0, Math.round((crop.y - bounds.y) * scaleY))
      const width = Math.min(image.width - originX, Math.max(1, Math.round(crop.width * scaleX)))
      const height = Math.min(image.height - originY, Math.max(1, Math.round(crop.height * scaleY)))
      const result = await manipulateAsync(
        image.uri,
        [{ crop: { originX, originY, width, height } }],
        { compress: 0.92, format: SaveFormat.JPEG },
      )
      onComplete(result)
    } catch {
      onError()
    } finally {
      setWorking(false)
    }
  }
  return (
    <Modal visible={Boolean(image)} animationType="slide" onRequestClose={onCancel}>
      <View style={s.screen}>
        <View style={s.header}>
          <Pressable accessibilityRole="button" onPress={onCancel}>
            <Text style={s.link}>取消</Text>
          </Pressable>
          <Text style={s.title}>截取要记录的区域</Text>
          <NotebookButton loading={working} onPress={() => void confirm()}>
            完成
          </NotebookButton>
        </View>
        <Text style={s.hint}>默认保留整张图片，拖动四角调整范围</Text>
        <NotebookSheet style={s.stage}>
          <View style={s.stageInner} onLayout={layout}>
            {image ? (
              <Image
                source={{ uri: image.uri }}
                resizeMode="contain"
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            <View pointerEvents="none" style={[s.crop, crop]} />
            {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
              <CropHandle
                key={corner}
                corner={corner}
                crop={crop}
                bounds={bounds}
                onChange={setCrop}
              />
            ))}
          </View>
        </NotebookSheet>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, padding: 20, paddingTop: 56, backgroundColor: c.paper },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { color: c.ink, fontSize: 18, fontWeight: '700' },
  link: { color: c.action, fontSize: 16 },
  hint: { color: c.muted, textAlign: 'center', marginVertical: 18 },
  stage: { flex: 1, padding: 0, overflow: 'hidden' },
  stageInner: { flex: 1, minHeight: 360, backgroundColor: '#26302b' },
  crop: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: c.accent,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  handle: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 4,
    borderColor: c.paper,
    backgroundColor: c.action,
  },
})
