import {
  explanationThreshold,
  explanationHistoryThreshold,
} from '@studycommit/common/paper-runtime'
import { useEffect, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  Animated,
  Easing,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { PaperExplainOutput } from '@studycommit/rpc-contracts/ai'
import { usePaperExplanation } from '@studycommit/common/paper-react'
import { motion, spacing, typography } from '@studycommit/design-tokens'
import { paperColors } from '../../features/papers/paper-visual'
import { papersActions, usePapersState } from '../../features/papers/papers-store'
import { useMobileServices } from '../../core/MobileServicesProvider'

export function AgentScreen() {
  const route = useRoute<{ key: string; name: 'Agent'; params: { paperId: string } }>()
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const state = usePapersState()
  const paper = state.papers.find((item) => item.id === route.params.paperId)
  const { ai } = useMobileServices()
  const flow = usePaperExplanation({
    paperId: route.params.paperId,
    content: paper?.content ?? '',
    ai,
    createIdempotencyKey: () => crypto.randomUUID(),
    onConfirmed: () => {
      papersActions.markQuestionConfirmed(route.params.paperId)
      navigation.goBack()
    },
  })
  const [translateX] = useState(() => new Animated.Value(0))
  const [translateY] = useState(() => new Animated.Value(0))
  const direction = useRef<'horizontal' | 'up' | null>(null)
  const [height, setHeight] = useState(500)
  const [bodyHeight, setBodyHeight] = useState(0)
  const [contentHeight, setContentHeight] = useState(0)
  const [angle] = useState(() => new Animated.Value(0))
  const cancelled = useRef(false)
  const [confirming, setConfirming] = useState(false)
  const [width, setWidth] = useState(300)
  const [reduced, setReduced] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  useEffect(() => {
    let active = true
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) {
        setReduced(value)
      }
    })
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced)
    return () => {
      active = false
      listener.remove()
      translateX.stopAnimation()
      translateY.stopAnimation()
      angle.stopAnimation()
    }
  }, [translateX, translateY, angle])
  const threshold = explanationThreshold(width)
  const upThreshold = explanationHistoryThreshold(height)
  const reset = () =>
    Animated.parallel(
      [translateX, translateY, angle].map((value) =>
        Animated.timing(value, {
          toValue: 0,
          duration: reduced ? 0 : motion.durationFast,
          useNativeDriver: true,
        }),
      ),
    ).start()
  const slide = (direction: number) =>
    new Promise<void>((resolve) => {
      const config = {
        duration: reduced ? 0 : motion.durationSlow,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true,
      }
      Animated.parallel([
        Animated.timing(translateX, { ...config, toValue: direction * (width + 50) }),
        Animated.timing(angle, { ...config, toValue: direction * 6 }),
      ]).start(() => resolve())
    })
  const command = async (direction: number) => {
    if (flow.busy) {
      return
    }
    setConfirming(direction > 0)
    if (direction < 0) {
      await flow.advance(() => slide(-1))
    } else {
      await flow.confirm(() => slide(1))
    }
    translateX.setValue(0)
    angle.setValue(0)
    setConfirming(false)
  }
  // eslint-disable-next-line react-hooks/refs -- PanResponder 只在触摸回调读写取消标记，不在渲染时读取。
  const pan = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) =>
      !flow.busy &&
      !!flow.current &&
      g.numberActiveTouches === 1 &&
      ((Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4) ||
        (g.dy < -12 && Math.abs(g.dy) > Math.abs(g.dx) * 1.4)),
    onPanResponderGrant: (_, g) => {
      direction.current = Math.abs(g.dx) > Math.abs(g.dy) ? 'horizontal' : 'up'
      cancelled.current = false
    },
    onPanResponderMove: (_, g) => {
      if (g.numberActiveTouches !== 1) {
        cancelled.current = true
        reset()
      } else if (direction.current === 'up') {
        translateY.setValue(Math.min(0, g.dy))
      } else {
        translateX.setValue(g.dx)
        angle.setValue(Math.max(-3.1, Math.min(3.1, (g.dx / threshold) * 3)))
      }
    },
    onPanResponderRelease: (_, g) => {
      if (!cancelled.current && direction.current === 'up') {
        if (-g.dy >= upThreshold) {
          setHistoryOpen(true)
        }
        reset()
        return
      }
      if (cancelled.current || Math.abs(g.dx) < threshold) {
        reset()
      } else {
        void command(g.dx < 0 ? -1 : 1)
      }
    },
    onPanResponderTerminate: reset,
  })
  const intent = (side: number) =>
    translateX.interpolate({
      inputRange: side < 0 ? [-threshold, -threshold / 6, 0] : [0, threshold / 6, threshold],
      outputRange: side < 0 ? [1, 0, 0] : [0, 0, 1],
      extrapolate: 'clamp',
    })
  return (
    <View style={[styles.page, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回记录"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text>返回</Text>
        </Pressable>
        <Text style={styles.title}>StudyCommit</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="展开原问题"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(!expanded)}
        style={styles.context}
      >
        <Text style={styles.contextSource}>
          {expanded ? paper?.questionText || paper?.content : '原问题 ›'}
        </Text>
      </Pressable>
      <View
        style={styles.deck}
        onLayout={(e) => {
          setWidth(e.nativeEvent.layout.width - 40)
          setHeight(e.nativeEvent.layout.height - spacing.lg * 2)
        }}
      >
        {flow.next && !confirming && (
          <Animated.View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              styles.card,
              {
                position: 'absolute',
                left: 20,
                right: 20,
                top: spacing.lg,
                bottom: spacing.lg,
                opacity: translateX.interpolate({
                  inputRange: [-1, 0],
                  outputRange: [1, 0],
                  extrapolate: 'clamp',
                }),
              },
            ]}
          >
            <Animated.View
              style={{
                opacity: translateX.interpolate({
                  inputRange: [-threshold, (-threshold * 2) / 3, 0],
                  outputRange: [1, 0, 0],
                  extrapolate: 'clamp',
                }),
              }}
            >
              <ExplainViewContent result={flow.next} />
            </Animated.View>
          </Animated.View>
        )}
        <Animated.View
          {...pan.panHandlers}
          style={[
            styles.card,
            {
              flex: 1,
              transform: reduced
                ? []
                : [
                    { translateX },
                    { translateY },
                    {
                      rotate: angle.interpolate({
                        inputRange: [-6, 6],
                        outputRange: ['-6deg', '6deg'],
                      }),
                    },
                  ],
            },
          ]}
        >
          <View
            accessible
            accessibilityLabel="解释卡"
            accessibilityHint="向左换个说法，向右确认理解，向上回看解释；也可使用辅助操作"
            accessibilityActions={[
              { name: 'increment', label: '换个说法' },
              { name: 'decrement', label: '理解了' },
              { name: 'history', label: '回看解释' },
            ]}
            onAccessibilityAction={(e) =>
              e.nativeEvent.actionName === 'history'
                ? setHistoryOpen(true)
                : void command(e.nativeEvent.actionName === 'increment' ? -1 : 1)
            }
            style={{ height: 24, alignItems: 'flex-end' }}
          >
            <Animated.Text style={{ position: 'absolute', fontSize: 13, opacity: intent(-1) }}>
              不理解
            </Animated.Text>
            <Animated.Text style={{ position: 'absolute', fontSize: 13, opacity: intent(1) }}>
              理解了
            </Animated.Text>
          </View>
          <Animated.Text
            style={{
              position: 'absolute',
              right: 24,
              top: 24,
              opacity: translateY.interpolate({
                inputRange: [-upThreshold, 0],
                outputRange: [1, 0],
                extrapolate: 'clamp',
              }),
            }}
          >
            回看解释
          </Animated.Text>
          <ScrollView
            onLayout={(e) => setBodyHeight(e.nativeEvent.layout.height)}
            onContentSizeChange={(_, h) => setContentHeight(h)}
            scrollEnabled={contentHeight > bodyHeight + 1}
          >
            {flow.current ? (
              <ExplainViewContent key={flow.current.runId} result={flow.current} />
            ) : (
              <Text selectable style={styles.cardBody}>
                {flow.preparing
                  ? '正在生成…'
                  : flow.price
                    ? `生成这张解释卡将消耗 ${flow.price.credits} 积分。`
                    : '解释暂不可用,请稍后重试。'}
              </Text>
            )}
            {!flow.current && !flow.preparing && flow.price && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`生成解释（消耗 ${flow.price.credits} 积分）`}
                onPress={() => {
                  void flow.generateFirst()
                }}
                style={{ padding: spacing.lg, alignItems: 'center' }}
              >
                <Text>生成解释（消耗 {flow.price.credits} 积分）</Text>
              </Pressable>
            )}
          </ScrollView>
        </Animated.View>
      </View>
      {flow.busy && (
        <Text accessibilityLiveRegion="polite" style={styles.cardHint}>
          正在处理，请稍候…
        </Text>
      )}
      {flow.error && (
        <View>
          <Text accessibilityRole="alert" style={styles.errorText}>
            {flow.error}
          </Text>
          <Pressable accessibilityRole="button" onPress={flow.retry} disabled={flow.busy}>
            <Text style={{ padding: 12 }}>重试</Text>
          </Pressable>
        </View>
      )}
      {historyOpen && (
        <View style={{ padding: spacing.lg }}>
          <Pressable accessibilityRole="button" onPress={() => setHistoryOpen(false)}>
            <Text style={{ padding: 12 }}>收起回看</Text>
          </Pressable>
          {flow.history.map((item, i) => (
            <Pressable
              key={item.runId}
              accessibilityRole="button"
              onPress={() => {
                flow.select(i)
                setHistoryOpen(false)
              }}
            >
              <Text style={{ padding: 12 }}>第 {i + 1} 种解释</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: paperColors.canvas },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    minHeight: 52,
  },
  backButton: { minWidth: 48, height: 44, alignItems: 'center', justifyContent: 'center' },
  endButton: { width: 48 },
  title: { color: paperColors.ink, ...typography.subheading, fontWeight: '500' },
  endText: { color: paperColors.action, fontSize: 14 },
  context: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  contextTopic: {
    color: paperColors.action,
    fontSize: 11,
    backgroundColor: paperColors.actionSurface,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  contextSource: { flex: 1, color: paperColors.muted, fontSize: 12 },
  deck: {
    overflow: 'hidden',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: spacing.lg,
  },
  card: {
    backgroundColor: paperColors.paper,
    maxHeight: '100%',
    borderRadius: 6,

    borderWidth: 1,
    borderColor: paperColors.line,
    padding: 24,
    gap: 14,
    shadowColor: paperColors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardStep: { color: paperColors.muted, fontSize: 10 },
  cardTitle: { color: paperColors.ink, fontSize: 18, fontWeight: '600' },
  cardBody: { color: paperColors.ink, ...typography.body, marginBottom: spacing.md },
  cardExample: { color: paperColors.muted, ...typography.bodySmall, marginBottom: spacing.md },
  cardHint: { color: paperColors.action, fontSize: 11 },
  errorText: { color: '#9A4D43', fontSize: 11, lineHeight: 18 },
  cardDivider: { height: StyleSheet.hairlineWidth, backgroundColor: paperColors.line },
  swipeGuide: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingBottom: 12,
  },
  swipeText: { color: paperColors.muted, fontSize: 11 },
})

function ExplainViewContent({ result }: { result: PaperExplainOutput }) {
  const { view, example } = result
  const [exampleOpen, setExampleOpen] = useState(false)
  return (
    <>
      <Text style={styles.cardTitle}>{viewTitle(view.type)}</Text>
      {view.type === 'causal_chain' &&
        view.steps.map((step) => (
          <Text key={step.title} style={styles.cardExample}>
            {step.title}：{step.detail}
          </Text>
        ))}
      {view.type === 'contrast' &&
        view.items.map((item) => (
          <Text key={item.aspect} style={styles.cardExample}>
            {item.aspect}：{item.a} / {item.b}
          </Text>
        ))}
      {view.type === 'checklist' &&
        view.steps.map((step) => (
          <Text key={step.action} style={styles.cardExample}>
            □ {step.action}：{step.reason}
          </Text>
        ))}
      {view.type === 'definition_counterexample' && (
        <>
          <Text selectable style={styles.cardBody}>
            {view.definition}
          </Text>
          <Text selectable style={styles.cardExample}>
            反例：{view.counterexample}
          </Text>
        </>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: exampleOpen }}
        onPress={() => setExampleOpen(!exampleOpen)}
      >
        <Text style={[styles.cardExample, { paddingVertical: 12 }]}>
          看个例子 {exampleOpen ? '⌄' : '›'}
        </Text>
      </Pressable>
      {exampleOpen && (
        <Text selectable style={styles.cardExample}>
          {example}
        </Text>
      )}
    </>
  )
}

function viewTitle(type: PaperExplainOutput['view']['type']): string {
  switch (type) {
    case 'causal_chain':
      return '因果链'
    case 'contrast':
      return '对照来看'
    case 'checklist':
      return '检查步骤'
    case 'definition_counterexample':
      return '一句话定义'
  }
}
