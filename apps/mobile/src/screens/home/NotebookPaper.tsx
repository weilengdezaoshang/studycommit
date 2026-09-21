import { useId, useState, type PropsWithChildren } from 'react'
import { StyleSheet, View } from 'react-native'
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg'
import { spacing, studyCommitMistBlueColors as colors } from '@studycommit/design-tokens'

/** 轮廓按实际纸页尺寸绘制，文字增减不会拉伸描边或折角。 */
export function NotebookPaper({ children }: PropsWithChildren) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  const gradient = useId().replace(/[^a-zA-Z0-9]/g, '')
  const w = size.width
  const h = size.height
  const fold = 22
  const outline = `M 13 5
    C ${w * 0.24} 1, ${w * 0.56} 8, ${w - 15} 4
    Q ${w - 3} 4, ${w - 4} 16
    C ${w - 1} ${h * 0.31}, ${w - 7} ${h * 0.66}, ${w - 4} ${h - fold - 7}
    Q ${w - 4} ${h - fold}, ${w - 8} ${h - fold + 5}
    L ${w - fold - 5} ${h - 5}
    C ${w * 0.63} ${h - 2}, ${w * 0.27} ${h - 7}, 12 ${h - 4}
    Q 3 ${h - 3}, 4 ${h - 15}
    C 7 ${h * 0.65}, 1 ${h * 0.29}, 5 16
    Q 4 5, 13 5 Z`
  return (
    <View
      style={styles.paper}
      onLayout={({ nativeEvent: { layout } }) => {
        setSize((current) =>
          current.width === layout.width && current.height === layout.height
            ? current
            : { width: layout.width, height: layout.height },
        )
      }}
    >
      {w > 0 && h > 0 && (
        <View
          pointerEvents="none"
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={StyleSheet.absoluteFill}
        >
          <Svg width={w} height={h}>
            <Defs>
              <LinearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={colors.paper} />
                <Stop offset="0.65" stopColor={colors.paper} />
                <Stop offset="1" stopColor={colors.surfaceSoft} />
              </LinearGradient>
            </Defs>
            <Path
              d={outline}
              fill={`url(#${gradient})`}
              stroke={colors.lineStrong}
              strokeWidth={1.1}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d={`M ${w - fold - 5} ${h - 5} Q ${w - fold + 1} ${h - 16}, ${w - fold - 1} ${h - fold - 1} Q ${w - 13} ${h - fold + 3}, ${w - 4} ${h - fold - 7}`}
              fill={colors.selectedSurface}
              stroke={colors.lineStrong}
              strokeWidth={1}
              strokeLinejoin="round"
            />
            <Path
              d={`M 12 20 l 5 -6 M 12 27 l 8 -9 M ${w - 19} 21 l 5 -6 M 12 ${h - 20} l 4 -5 M 13 ${h - 13} l 7 -8`}
              fill="none"
              stroke={colors.line}
              strokeWidth={0.8}
              strokeLinecap="round"
            />
          </Svg>
        </View>
      )}
      {children}
    </View>
  )
}
const styles = StyleSheet.create({
  paper: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
})
