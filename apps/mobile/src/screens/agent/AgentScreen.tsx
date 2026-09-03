import { useCallback, useEffect, useMemo, useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { PaperExplainOutput } from '@studycommit/rpc-contracts/ai'
import { paperColors } from '../../features/papers/paper-visual'
import { papersActions, usePapersState } from '../../features/papers/papers-store'
import { useMobileServices } from '../../core/MobileServicesProvider'

/**
 * Agent 学习闭环:只有手势方向,没有固定按钮。
 * 左推“不理解”换一种说法(最多三张);右推“理解了”结束并返回纸页。
 */
const MAX_STEP = 3
const SWIPE_RATIO = 0.22
const CARD_WIDTH_ESTIMATE = 300
const FLICK_VELOCITY = 500
const FLICK_MIN_OFFSET = 24

const EXPLANATION_TEMPLATES = [
  {
    title: '先说结论',
    body: '把这条记录拆成一个问句,答案通常就藏在“为什么”三个字后面。',
    example: '试着用一句话回答:它解决的是谁的什么问题?',
  },
  {
    title: '换个更浅的说法',
    body: '想象你在给完全没接触过的朋友解释,先讲场景,再讲机制。',
    example: '比如:没有它会发生什么?哪个步骤会变慢或出错?',
  },
  {
    title: '最后一种理解',
    body: '把它和你已经懂的一件事类比,差异处就是关键概念。',
    example: '它像____一样,但区别在于____。',
  },
]

export function AgentScreen() {
  const route = useRoute<{ key: string; name: 'Agent'; params: { paperId: string } }>()
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const state = usePapersState()
  const { ai } = useMobileServices()
  const [step, setStep] = useState(0)
  const [result, setResult] = useState<PaperExplainOutput | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [translateX] = useState(() => new Animated.Value(0))

  const paper = useMemo(
    () => state.papers.find((item) => item.id === route.params.paperId),
    [state.papers, route.params.paperId],
  )
  const topic = paper?.topicId ? state.topics.find((item) => item.id === paper.topicId) : undefined

  const requestExplanation = useCallback(
    async (
      directive: 'initial' | 'plainer' | 'alternative',
      nextStep: number,
      previousViewType?: PaperExplainOutput['view']['type'],
    ) => {
      if (!paper) {
        return
      }
      setLoading(true)
      setError(null)
      try {
        const next = await ai.explainPaper({
          paperId: paper.id,
          content: paper.content,
          directive,
          previousViewType,
          round: Math.min(nextStep + 1, MAX_STEP),
        })
        setResult(next)
      } catch {
        setError('暂时拿不到新的解释，保留当前纸页内容。')
      } finally {
        setLoading(false)
      }
    },
    [ai, paper],
  )

  useEffect(() => {
    const timer = setTimeout(() => {
      void requestExplanation('initial', 0)
    }, 0)
    return () => clearTimeout(timer)
  }, [requestExplanation])

  const finish = useCallback(
    (direction: 'left' | 'right') => {
      Animated.timing(translateX, {
        toValue: direction === 'left' ? -500 : 500,
        duration: 220,
        useNativeDriver: true,
      }).start(() => {
        if (direction !== 'right' || !result || !paper) {
          navigation.goBack()
          return
        }
        void (async () => {
          setLoading(true)
          try {
            await ai.confirmPaperExplain({ runId: result.runId })
            papersActions.resolveQuestion(paper.id)
            navigation.goBack()
          } catch {
            setError('确认失败，纸页仍保留在“还在思考”。')
          } finally {
            setLoading(false)
          }
        })()
      })
    },
    [ai, navigation, paper, result, translateX],
  )

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 6,
        onPanResponderMove: (_, gesture) => {
          translateX.setValue(Math.max(-180, Math.min(180, gesture.dx)))
        },
        onPanResponderRelease: (_, gesture) => {
          const threshold = CARD_WIDTH_ESTIMATE * SWIPE_RATIO
          const flicked =
            Math.abs(gesture.vx) >= FLICK_VELOCITY && Math.abs(gesture.dx) >= FLICK_MIN_OFFSET
          if (Math.abs(gesture.dx) < threshold && !flicked) {
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
              speed: 30,
              bounciness: 6,
            }).start()
            return
          }
          const direction = gesture.dx < 0 ? 'left' : 'right'
          if (direction === 'right' || step >= MAX_STEP - 1) {
            finish(direction)
            return
          }
          Animated.timing(translateX, {
            toValue: direction === 'left' ? -500 : 500,
            duration: 180,
            useNativeDriver: true,
          }).start(() => {
            const nextStep = step + 1
            setStep(nextStep)
            translateX.setValue(0)
            void requestExplanation('plainer', nextStep, result?.view.type)
          })
        },
      }),
    [finish, requestExplanation, result, step, translateX],
  )

  if (!paper) {
    return <View style={styles.page} />
  }

  const rotation = translateX.interpolate({
    inputRange: [-180, 180],
    outputRange: ['-8deg', '8deg'],
    extrapolate: 'clamp',
  })

  return (
    <View style={styles.page}>
      <View style={[styles.topBar, { paddingTop: insets.top + 4 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回纸页详情"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={22} color={paperColors.ink} />
        </Pressable>
        <Text style={styles.title}>继续弄懂</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="结束"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.endText}>结束</Text>
        </Pressable>
      </View>

      <View style={styles.context}>
        <Text style={styles.contextTopic}>{topic?.name ?? '待整理'}</Text>
        <Text numberOfLines={1} style={styles.contextSource}>
          {paper.content}
        </Text>
      </View>

      <View style={styles.deck}>
        <Animated.View
          {...panResponder.panHandlers}
          style={[styles.card, { transform: [{ translateX }, { rotate: rotation }] }]}
        >
          <Text style={styles.cardStep}>
            AI 解释 · 第 {Math.min(step, MAX_STEP - 1) + 1} 步，共 {MAX_STEP} 步
          </Text>
          {loading && <Text style={styles.cardHint}>正在换一种说法……</Text>}
          <Text style={styles.cardBody}>{paper.content}</Text>
          {result ? <ExplainViewContent result={result} /> : <FallbackExplanation step={step} />}
          {error && <Text style={styles.errorText}>{error}</Text>}
        </Animated.View>
      </View>

      <View style={styles.swipeGuide}>
        <Text style={styles.swipeText}>← 不理解</Text>
        <Text style={styles.swipeText}>理解了 →</Text>
      </View>
      <View style={{ paddingBottom: insets.bottom + 24 }} />
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
    height: 52,
  },
  backButton: { minWidth: 48, height: 44, alignItems: 'center', justifyContent: 'center' },
  endButton: { width: 48 },
  title: { color: paperColors.muted, fontSize: 14, fontWeight: '500' },
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
  deck: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  card: {
    backgroundColor: paperColors.paper,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paperColors.line,
    padding: 24,
    gap: 14,
    shadowColor: paperColors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  cardStep: { color: paperColors.muted, fontSize: 10 },
  cardTitle: { color: paperColors.ink, fontSize: 18, fontWeight: '600' },
  cardBody: { color: paperColors.ink, fontSize: 13, lineHeight: 22 },
  cardExample: { color: paperColors.muted, fontSize: 12, lineHeight: 20 },
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

function FallbackExplanation({ step }: { step: number }) {
  const explanation = EXPLANATION_TEMPLATES[Math.min(step, EXPLANATION_TEMPLATES.length - 1)]
  return (
    <>
      <Text style={styles.cardTitle}>{explanation.title}</Text>
      <Text style={styles.cardExample}>{explanation.body}</Text>
      <View style={styles.cardDivider} />
      <Text style={styles.cardExample}>{explanation.example}</Text>
    </>
  )
}

function ExplainViewContent({ result }: { result: PaperExplainOutput }) {
  const { view, example } = result
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
          <Text style={styles.cardBody}>{view.definition}</Text>
          <Text style={styles.cardExample}>反例：{view.counterexample}</Text>
        </>
      )}
      <View style={styles.cardDivider} />
      <Text style={styles.cardExample}>{example}</Text>
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
