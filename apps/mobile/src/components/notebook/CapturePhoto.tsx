import { Image, StyleSheet, Text, View, type ImageStyle, type StyleProp } from 'react-native'
import { spacing, studyCommitMistBlueColors as c } from '@studycommit/design-tokens'

/** 仅 sample:// 引用渲染设计样本；真实照片始终使用平台 Image。 */
export function CapturePhoto({ uri, style }: { uri: string; style?: StyleProp<ImageStyle> }) {
  if (!uri.startsWith('sample://')) {
    return <Image source={{ uri }} style={style} resizeMode="contain" />
  }
  const index = Number(uri.slice(-1)) - 1
  return (
    <View style={[style, s.paper]}>
      <Text numberOfLines={2} style={s.title}>
        {['合上书，回想一次', '留一点时间给记忆', '把问题留在纸上'][index]}
      </Text>
      <View style={s.line} />
      <Text numberOfLines={3} style={s.body}>
        {['用自己的话讲一遍。', '隔一段时间，再回想。', '从想不起来的地方开始。'][index]}
      </Text>
      <View style={s.line} />
      <Text style={s.caption}>示例学习卡片 {index + 1}</Text>
    </View>
  )
}
const s = StyleSheet.create({
  paper: {
    backgroundColor: c.paper,
    justifyContent: 'space-around',
    padding: spacing.sm,
    overflow: 'hidden',
  },
  title: { color: c.ink, fontSize: 20 },
  body: { color: c.ink, fontSize: 16 },
  caption: { color: c.muted, fontSize: 12 },
  line: { height: 1, backgroundColor: c.line },
})
