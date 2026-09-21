import { useEffect, useState, type PropsWithChildren } from 'react'
import { AccessibilityInfo, Animated, type StyleProp, type ViewStyle } from 'react-native'
import { motion, spacing } from '@studycommit/design-tokens'

/** 只在内容挂载时过渡；输入更新不会重新启动。系统减少动态时即时呈现。 */
export function PaperTransition({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const [progress] = useState(() => new Animated.Value(1))
  useEffect(() => {
    let mounted = true
    const stop = () => {
      progress.stopAnimation()
      progress.setValue(1)
    }
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (!mounted || reduced) {
          return
        }
        progress.setValue(0)
        Animated.timing(progress, {
          toValue: 1,
          duration: motion.durationFast,
          useNativeDriver: true,
        }).start()
      })
      .catch(stop)
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', (reduced) => {
      if (reduced) {
        stop()
      }
    })
    return () => {
      mounted = false
      listener.remove()
      stop()
    }
  }, [progress])
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [spacing.xs, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  )
}
