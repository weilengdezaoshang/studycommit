import { useEffect, useMemo, useState } from 'react'
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { motion } from '@studycommit/design-tokens'
import type { MonthlyReview } from '@studycommit/common/contracts'
import {
  buildLocalMonthlyReview,
  canShiftTo,
  heatmapCells,
  localTimezone,
  monthKeyOf,
  monthLabelOf,
  shiftMonth,
  type HeatCell,
  type MonthCursor,
} from '@studycommit/common/review-runtime'
import { paperColors } from '../../features/papers/paper-visual'
import { usePapersState } from '../../features/papers/papers-store'
import { useMobileServices } from '../../core/MobileServicesProvider'

const BOOK_FLIP_MS = motion.durationSlow

/** 月份装订:这个月的散页装订成一本可以翻阅的学习册;翻月带书本翻页动效。 */
export function ReviewScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const services = useMobileServices()
  const state = usePapersState()
  const today = useMemo(() => new Date(), [])
  const [cursor, setCursor] = useState<MonthCursor>(() => ({
    year: today.getFullYear(),
    month: today.getMonth() + 1,
  }))
  const [serverReview, setServerReview] = useState<MonthlyReview | null>(null)
  const [offline, setOffline] = useState(false)
  /** 已完成拉取的月份;与当前游标不一致即视为加载中(派生,不在 effect 内同步置状态) */
  const [loadedMonth, setLoadedMonth] = useState<string | null>(null)
  const [reduceMotion, setReduceMotion] = useState(false)
  /** 进行中的翻页:层上显示离场的旧页,底层已切到目标月 */
  const [flip, setFlip] = useState<{ direction: 1 | -1; fromReview: MonthlyReview } | null>(null)
  // Animated.Value 一次性创建;不用 useRef 以免渲染期读取 ref(react-hooks/refs)
  const [flipAnimation] = useState(() => new Animated.Value(0))
  const [pageWidth, setPageWidth] = useState(0)

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => undefined)
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion)
    return () => {
      subscription.remove()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const month = monthKeyOf(cursor)
    services.reviews
      .monthly({ month, timezone: localTimezone() })
      .then((data) => {
        if (!cancelled) {
          setServerReview(data)
          setOffline(false)
          setLoadedMonth(month)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setServerReview(null)
          setOffline(true)
          setLoadedMonth(month)
        }
      })
    return () => {
      cancelled = true
    }
  }, [cursor, services])
  const loading = loadedMonth !== monthKeyOf(cursor)

  const localReview = useMemo(() => buildLocalMonthlyReview(state, cursor), [state, cursor])
  const display =
    serverReview && serverReview.month === monthKeyOf(cursor) ? serverReview : localReview

  const nextCursor = shiftMonth(cursor, 1)
  const nextDisabled = !canShiftTo(nextCursor, today)

  const changeMonth = (direction: 1 | -1) => {
    if (flip) {
      return
    }
    const to = shiftMonth(cursor, direction)
    if (direction === 1 && !canShiftTo(to, today)) {
      return
    }
    if (reduceMotion) {
      setCursor(to)
      return
    }
    setFlip({ direction, fromReview: display })
    flipAnimation.setValue(0)
    Animated.timing(flipAnimation, {
      toValue: 1,
      duration: BOOK_FLIP_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setFlip(null)
        flipAnimation.setValue(0)
      }
    })
    setCursor(to)
  }

  const shownCursor = flip ? shiftMonth(cursor, flip.direction) : cursor

  return (
    <View style={styles.page}>
      <View style={[styles.topBar, { paddingTop: insets.top + 4 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="关闭月份装订"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={22} color={paperColors.ink} />
        </Pressable>
        <Text style={styles.title}>{monthLabelOf(cursor)}装订</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View
          style={styles.bookArea}
          onLayout={(event) => setPageWidth(event.nativeEvent.layout.width)}
        >
          <BookPage
            review={display}
            cursor={shownCursor}
            loading={loading && !offline}
            offline={offline}
          />
          {flip && pageWidth > 0 ? (
            <Animated.View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[
                styles.flipLayer,
                {
                  transform:
                    flip.direction === 1
                      ? [
                          { translateX: pageWidth / 2 },
                          { perspective: 1200 },
                          {
                            rotateY: flipAnimation.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0deg', '-90deg'],
                            }),
                          },
                          { translateX: -pageWidth / 2 },
                        ]
                      : [
                          { translateX: -pageWidth / 2 },
                          { perspective: 1200 },
                          {
                            rotateY: flipAnimation.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0deg', '90deg'],
                            }),
                          },
                          { translateX: pageWidth / 2 },
                        ],
                },
              ]}
            >
              <BookPage
                review={flip.fromReview}
                cursor={shiftMonth(cursor, -flip.direction)}
                loading={false}
                offline={offline}
              />
            </Animated.View>
          ) : null}
        </View>

        <View style={styles.pageControls}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="翻到上一个月"
            onPress={() => changeMonth(-1)}
            style={styles.pageButton}
          >
            <Ionicons name="chevron-back" size={20} color={paperColors.ink} />
          </Pressable>
          <Text style={styles.pageMonth}>{monthLabelOf(cursor)}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="翻到下一个月"
            onPress={() => changeMonth(1)}
            disabled={nextDisabled}
            style={[styles.pageButton, nextDisabled && styles.pageButtonDisabled]}
          >
            <Ionicons name="chevron-forward" size={20} color={paperColors.ink} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  )
}

function BookPage({
  review,
  cursor,
  loading,
  offline,
}: {
  review: MonthlyReview
  cursor: MonthCursor
  loading: boolean
  offline: boolean
}) {
  const cells = useMemo(() => heatmapCells(review.days, cursor), [review.days, cursor])
  const statValue = (value: number) => (loading ? '…' : String(value))
  return (
    <View style={styles.book}>
      <Text style={styles.bookKicker}>{monthLabelOf(cursor)}</Text>
      <Text style={styles.bookTitle}>学习装订</Text>
      <Text style={styles.bookCopy}>理解不是一次完成的，它在记录、整理与追问之间慢慢变厚。</Text>

      <View style={styles.stats}>
        <View style={styles.stat} accessibilityLabel={`本月纸页 ${review.paperCount}`}>
          <Text style={styles.statValue}>{statValue(review.paperCount)}</Text>
          <Text style={styles.statLabel}>纸页</Text>
        </View>
        <View style={styles.stat} accessibilityLabel={`本月箱子 ${review.topicCount}`}>
          <Text style={styles.statValue}>{statValue(review.topicCount)}</Text>
          <Text style={styles.statLabel}>箱子</Text>
        </View>
        <View style={styles.stat} accessibilityLabel={`本月解决 ${review.resolvedCount}`}>
          <Text style={styles.statValue}>{statValue(review.resolvedCount)}</Text>
          <Text style={styles.statLabel}>解决</Text>
        </View>
      </View>

      <View style={styles.heatGrid}>
        {cells.map((cell, index) => (
          <HeatDay key={cell.dateKey ?? `empty-${index}`} cell={cell} />
        ))}
      </View>
      {offline ? <Text style={styles.offlineNote}>离线统计，联网后自动同步</Text> : null}
    </View>
  )
}

function HeatDay({ cell }: { cell: HeatCell }) {
  if (!cell.dateKey) {
    return <View style={styles.heatCell} />
  }
  return (
    <View
      accessibilityLabel={`${cell.dateKey} 有 ${cell.count} 张纸页`}
      style={[
        styles.heatCell,
        cell.level > 0 && { backgroundColor: paperColors.action },
        cell.level === 1 && { opacity: 0.35 },
        cell.level === 2 && { opacity: 0.65 },
      ]}
    >
      <Text style={[styles.heatDayText, cell.level === 3 && styles.heatDayTextStrong]}>
        {Number(cell.dateKey.slice(-2))}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: paperColors.paper },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    height: 52,
  },
  backButton: { minWidth: 48, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { color: paperColors.muted, fontSize: 14, fontWeight: '500' },
  body: { padding: 20, gap: 20 },
  bookArea: { position: 'relative' },
  book: {
    backgroundColor: paperColors.action,
    borderRadius: 16,
    padding: 24,
    gap: 16,
    shadowColor: paperColors.ink,
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  bookKicker: { color: paperColors.accent, fontSize: 11, letterSpacing: 2 },
  bookTitle: { color: paperColors.paper, fontSize: 28, fontWeight: '600' },
  bookCopy: { color: paperColors.paper, opacity: 0.85, fontSize: 14, lineHeight: 24 },
  stats: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center', gap: 4 },
  statValue: { color: paperColors.paper, fontSize: 26, fontWeight: '600' },
  statLabel: { color: paperColors.paper, opacity: 0.8, fontSize: 12 },
  heatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  heatCell: {
    width: '13%',
    aspectRatio: 1,
    maxWidth: 40,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: paperColors.actionSurface,
  },
  heatDayText: { color: paperColors.ink, fontSize: 10 },
  heatDayTextStrong: { color: paperColors.paper },
  offlineNote: { color: paperColors.paper, opacity: 0.7, fontSize: 11 },
  flipLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  pageControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  pageButton: {
    minWidth: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: paperColors.actionSurface,
  },
  pageButtonDisabled: { opacity: 0.35 },
  pageMonth: { color: paperColors.muted, fontSize: 13, fontWeight: '500' },
})
