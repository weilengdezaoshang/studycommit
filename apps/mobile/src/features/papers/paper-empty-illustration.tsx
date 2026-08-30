import { StyleSheet, View } from 'react-native'
import { paperColors } from './paper-visual'

/** 空态插画:软圆底上一叠散页,其中一张带黄色折角。纯 View 绘制,不依赖图片资源。 */
export function PaperEmptyIllustration({ size = 120 }: { size?: number }) {
  return (
    <View style={[styles.wrap, { width: size, height: size * 0.8 }]} aria-hidden>
      <View style={styles.circle} />
      {/* 后层纸页 */}
      <View style={[styles.sheet, styles.sheetBack]}>
        <View style={styles.sheetLine} />
        <View style={[styles.sheetLine, { width: '60%' }]} />
      </View>
      {/* 前层纸页 + 折角 */}
      <View style={[styles.sheet, styles.sheetFront]}>
        <View style={styles.fold} />
        <View style={[styles.sheetLine, { width: '72%' }]} />
        <View style={[styles.sheetLine, { width: '52%' }]} />
      </View>
      {/* 铅笔点 */}
      <View style={styles.accentDot} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  circle: {
    position: 'absolute',
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: paperColors.surfaceWarm,
  },
  sheet: {
    position: 'absolute',
    width: 46,
    height: 58,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: paperColors.lineStrong,
    backgroundColor: paperColors.paper,
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 8,
    paddingLeft: 8,
    shadowColor: paperColors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  sheetBack: { transform: [{ rotate: '-8deg' }, { translateX: -16 }] },
  sheetFront: { transform: [{ rotate: '6deg' }, { translateX: 12 }, { translateY: -6 }] },
  sheetLine: { height: 3, borderRadius: 2, backgroundColor: paperColors.line },
  fold: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 0,
    height: 0,
    borderTopWidth: 14,
    borderLeftWidth: 14,
    borderTopColor: paperColors.accent,
    borderLeftColor: 'transparent',
    borderTopRightRadius: 5,
  },
  accentDot: {
    position: 'absolute',
    right: 14,
    top: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: paperColors.accent,
  },
})
