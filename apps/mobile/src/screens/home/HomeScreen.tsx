import { CaptureEntry } from '../../components/notebook/CaptureEntry'
import { paperTypography } from '../../theme/paper-typography'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import {
  Alert,
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Notebook } from './Notebook'
import { motion, lightColors, typography } from '@studycommit/design-tokens'
import { paperColors } from '../../features/papers/paper-visual'
import { papersActions, usePapersState } from '../../features/papers/papers-store'
import { resetPapersStore } from '../../features/papers/papers-store'
import { useAuthSession, clearAuthSession } from '../../infrastructure/auth/session-store'
import {
  buildHomeViewModel,
  INBOX_TOPIC_ID,
  parseDateKey,
  type HomeViewModel,
} from '../../features/papers/view-model'
import { shiftDateKey } from '@studycommit/common/study-session-runtime'
import type { RootStackParamList } from '../../navigation/navigation.types'

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']
const VISIBLE_TOPIC_COUNT = 4
const DRAWER_MAX_WIDTH = 360

type Navigation = NativeStackNavigationProp<RootStackParamList>

export function HomeScreen() {
  const state = usePapersState()
  const navigation = useNavigation<Navigation>()
  const insets = useSafeAreaInsets()

  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKeyFromDate(new Date()))
  const [cursor, setCursor] = useState(() => parseDateKey(selectedDateKey))
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [wheelOpen, setWheelOpen] = useState(false)
  const [wheelDraft, setWheelDraft] = useState({ year: cursor.year, month: cursor.month })
  const [drawerAnim] = useState(() => new Animated.Value(0))
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null)
  const [dateFilter, setDateFilter] = useState<string | null>(null)
  const [reducedMotion, setReducedMotion] = useState(true)
  useEffect(() => {
    let active = true
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active) {
          setReducedMotion(value)
        }
      })
      .catch(() => undefined)
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion)
    return () => {
      active = false
      listener.remove()
    }
  }, [])

  const vm = useMemo(
    () => buildHomeViewModel(state, selectedDateKey, cursor, selectedTopicId),
    [state, selectedDateKey, cursor, selectedTopicId],
  )

  const openDrawer = () => {
    setDrawerOpen(true)
    Animated.timing(drawerAnim, {
      toValue: 1,
      duration: reducedMotion ? 0 : motion.durationNormal,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }

  const closeDrawer = () => {
    Animated.timing(drawerAnim, {
      toValue: 0,
      duration: reducedMotion ? 0 : motion.durationFast,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setDrawerOpen(false)
      }
    })
  }

  const openPaper = (paperId: string) => navigation.navigate('PaperDetail', { paperId })

  /** 抽屉点箱子:筛选首页时间流;再次点同一箱子取消筛选(PRD §5.4)。 */
  const handleSelectTopic = (topicId: string) => {
    setSelectedTopicId((current) => (current === topicId ? null : topicId))
    setDateFilter(null)
    closeDrawer()
  }

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <HomeHeader onOpenDrawer={openDrawer} />
      <Notebook
        showCreate={!__DEV__}
        vm={vm}
        date={dateFilter}
        topicId={selectedTopicId}
        bottom={insets.bottom}
        onClear={() => {
          setDateFilter(null)
          setSelectedTopicId(null)
        }}
        onCreate={() => navigation.navigate('NoteEditor')}
        onOpen={openPaper}
        onExplain={(paperId) => navigation.navigate('Agent', { paperId })}
      />

      {__DEV__ && (
        <CaptureEntry
          onSelect={(mode) =>
            mode === 'text'
              ? navigation.navigate('NoteEditor')
              : navigation.navigate('Capture', { mode })
          }
        />
      )}
      {__DEV__ && (
        <Pressable
          accessibilityLabel="图片页面设计预览"
          onPress={() => navigation.navigate('CaptureDesign')}
        >
          <Text style={{ color: paperColors.muted, textAlign: 'center' }}>图片页面设计预览</Text>
        </Pressable>
      )}
      {drawerOpen && (
        <Pressable style={styles.scrim} onPress={closeDrawer} accessibilityLabel="关闭学习抽屉">
          <View />
        </Pressable>
      )}
      {wheelOpen && (
        <View style={styles.wheelOverlay}>
          <Pressable
            accessibilityLabel="取消年月选择"
            style={StyleSheet.absoluteFill}
            onPress={() => setWheelOpen(false)}
          />
          <View style={styles.wheelSheet} accessibilityLabel="选择年月">
            <View style={styles.wheelHeader}>
              <Text style={styles.wheelTitle}>选择年月</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setCursor({ year: wheelDraft.year, month: wheelDraft.month, day: 1 })
                  setWheelOpen(false)
                }}
              >
                <Text style={styles.wheelApply}>完成</Text>
              </Pressable>
            </View>
            <Text accessibilityLiveRegion="polite" style={styles.wheelPreview}>
              {wheelDraft.year} 年 {wheelDraft.month} 月
            </Text>
            <View style={styles.wheelColumns}>
              <WheelColumn
                label="年份"
                items={WHEEL_YEARS}
                value={wheelDraft.year}
                suffix="年"
                onChange={(year) => setWheelDraft((draft) => ({ ...draft, year }))}
              />
              <WheelColumn
                label="月份"
                items={WHEEL_MONTHS}
                value={wheelDraft.month}
                suffix="月"
                onChange={(month) => setWheelDraft((draft) => ({ ...draft, month }))}
              />
            </View>
            <Text style={styles.wheelHint}>上下滚动选择 · 点击外侧取消</Text>
          </View>
        </View>
      )}
      {drawerOpen && (
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.drawer,
            {
              paddingTop: insets.top + 8,
              transform: [
                {
                  translateX: drawerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-400, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <DrawerProfile onClose={closeDrawer} />
          <ScrollView showsVerticalScrollIndicator={false}>
            <DrawerRow
              icon="book-outline"
              label="记录本"
              count={0}
              selected={!selectedTopicId && !dateFilter}
              onPress={() => {
                setDateFilter(null)
                setSelectedTopicId(null)
                closeDrawer()
              }}
            />
            <DrawerRow
              icon="search-outline"
              label="搜索"
              count={0}
              selected={false}
              onPress={() => {
                closeDrawer()
                navigation.navigate('Search')
              }}
            />
            <AttentionSection
              vm={vm}
              selectedTopicId={selectedTopicId}
              onSelectTopic={handleSelectTopic}
              onOpenProblems={() => {
                closeDrawer()
                navigation.navigate('Problems')
              }}
            />
            <TopicSection
              vm={vm}
              selectedTopicId={selectedTopicId}
              onSelectTopic={handleSelectTopic}
              onCreateTopic={() => {
                void papersActions
                  .createTopic(`未命名的知识 ${vm.topicRows.length + 1}`)
                  .then((topic) => {
                    closeDrawer()
                    navigation.navigate('Collection', { mode: 'box', topicId: topic.id })
                  })
                  .catch(() => undefined)
              }}
              onViewAll={() => {
                closeDrawer()
                navigation.navigate('Topics')
              }}
            />

            <View style={styles.calendarSection}>
              <MonthNav
                label={vm.monthNavLabel}
                onPrev={() => setCursor(shiftDateKeyCursor(cursor, -1))}
                onNext={() => setCursor(shiftDateKeyCursor(cursor, 1))}
                onOpenMonth={() => {
                  setWheelDraft({ year: cursor.year, month: cursor.month })
                  setWheelOpen(true)
                }}
              />
              <CalendarGrid
                weeks={vm.monthWeeks}
                onSelectDate={(dateKey) => {
                  setSelectedDateKey(dateKey)
                  setDateFilter(dateKey)
                  closeDrawer()
                }}
              />
              <View style={styles.monthSummary}>
                <Text style={styles.monthSummaryText}>
                  本月 {vm.monthWeeks.flat().reduce((total, day) => total + day.count, 0)} 条记录 ·{' '}
                  {vm.monthWeeks.flat().filter((day) => day.count > 0).length} 天留下想法
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setDateFilter(selectedDateKey)
                    closeDrawer()
                  }}
                  style={styles.summaryAction}
                >
                  <Text style={styles.monthSummaryText}>
                    {Number(selectedDateKey.slice(5, 7))}月{Number(selectedDateKey.slice(8))}日
                  </Text>
                  <Text style={styles.monthSummaryText}>查看记录 →</Text>
                </Pressable>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  closeDrawer()
                  navigation.navigate('Review')
                }}
                style={styles.summaryAction}
              >
                <Text style={styles.monthSummaryText}>查看月度装订 →</Text>
              </Pressable>
            </View>
          </ScrollView>
        </Animated.View>
      )}
    </View>
  )
}

function shiftDateKeyCursor(cursor: { year: number; month: number; day: number }, delta: number) {
  const next = shiftDateKey(
    `${cursor.year}-${String(cursor.month).padStart(2, '0')}-${String(cursor.day).padStart(2, '0')}`,
    delta,
  )
  return parseDateKey(next)
}

function toDateKeyFromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function HomeHeader({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  return (
    <View style={styles.header}>
      <IconButton name="menu" label="打开学习抽屉" onPress={onOpenDrawer} />
      <View style={styles.headerCenter}>
        <Ionicons name="book-outline" size={24} color={paperColors.ink} />
        <Text style={styles.headerTitle}>StudyCommit</Text>
      </View>
      <View style={styles.headerSpacer} />
    </View>
  )
}

function IconButton({
  name,
  label,
  onPress,
  iconSize = 20,
  buttonSize = 44,
  color = paperColors.ink,
}: {
  name: keyof typeof Ionicons.glyphMap
  label: string
  onPress: () => void
  iconSize?: number
  buttonSize?: number
  color?: string
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={8}
      style={[styles.iconButton, { width: buttonSize, height: buttonSize }]}
    >
      <Ionicons name={name} size={iconSize} color={color} />
    </Pressable>
  )
}

const WHEEL_ITEM_HEIGHT = 40
// 模块级常量:WheelColumn 的定位 effect 依赖 items,引用稳定才能避免滚动时被重置
const WHEEL_YEARS = Array.from({ length: 191 }, (_, index) => 1900 + index)
const WHEEL_MONTHS = Array.from({ length: 12 }, (_, index) => index + 1)
const WHEEL_VISIBLE_ITEMS = 6

function WheelColumn({
  label,
  items,
  value,
  suffix,
  onChange,
}: {
  label: string
  items: number[]
  value: number
  suffix: string
  onChange: (value: number) => void
}) {
  const listRef = useRef<ScrollView>(null)
  const pad = ((WHEEL_VISIBLE_ITEMS - 1) / 2) * WHEEL_ITEM_HEIGHT

  useEffect(() => {
    const index = Math.max(0, items.indexOf(value))
    listRef.current?.scrollTo({ y: index * WHEEL_ITEM_HEIGHT, animated: false })
    // 仅在打开/候选值重置时定位
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  return (
    <View style={styles.wheelColumn} accessibilityLabel={label}>
      <ScrollView
        ref={listRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ITEM_HEIGHT}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: pad }}
        onMomentumScrollEnd={(event) => {
          const index = Math.max(
            0,
            Math.min(
              items.length - 1,
              Math.round(event.nativeEvent.contentOffset.y / WHEEL_ITEM_HEIGHT),
            ),
          )
          if (items[index] !== value) {
            onChange(items[index])
          }
        }}
      >
        {items.map((item) => (
          <Pressable key={item} onPress={() => onChange(item)} style={styles.wheelItem}>
            <Text style={[styles.wheelItemText, item === value && styles.wheelItemTextSelected]}>
              {item} {suffix}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  )
}

function DrawerProfile({ onClose }: { onClose: () => void }) {
  const session = useAuthSession()
  const nickname = session?.user.nickname?.trim() || '我的学习'
  const avatarText = nickname.slice(0, 2)

  const confirmLogout = () => {
    Alert.alert('退出登录', '确定要退出当前账号吗？退出后需重新登录。', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出',
        style: 'destructive',
        onPress: () => {
          onClose()
          resetPapersStore()
          clearAuthSession()
        },
      },
    ])
  }

  return (
    <View style={styles.drawerProfile}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{avatarText}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.profileName} numberOfLines={1}>
          {nickname}
        </Text>
        <Text style={styles.monthSummaryText}>{session ? '已登录' : '本地记录'}</Text>
      </View>
      <View style={styles.drawerActions}>
        <IconButton
          name="log-out-outline"
          label="退出登录"
          onPress={confirmLogout}
          iconSize={16}
          buttonSize={32}
        />
        <IconButton
          name="close"
          label="关闭学习抽屉"
          onPress={onClose}
          iconSize={16}
          buttonSize={32}
        />
      </View>
    </View>
  )
}

function MonthNav({
  label,
  onPrev,
  onNext,
  onOpenMonth,
}: {
  label: string
  onPrev: () => void
  onNext: () => void
  onOpenMonth: () => void
}) {
  return (
    <View style={styles.monthNav}>
      <IconButton
        name="chevron-back"
        label="上一个月"
        onPress={onPrev}
        iconSize={14}
        buttonSize={44}
        color={paperColors.mutedSoft}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="选择年月"
        onPress={onOpenMonth}
        style={{ flex: 1, minHeight: 44, justifyContent: 'center' }}
      >
        <Text style={styles.monthLabel}>{label}</Text>
      </Pressable>
      <IconButton
        name="chevron-forward"
        label="下一个月"
        onPress={onNext}
        iconSize={14}
        buttonSize={44}
        color={paperColors.mutedSoft}
      />
    </View>
  )
}

function CalendarGrid({
  weeks,
  onSelectDate,
}: {
  weeks: HomeViewModel['monthWeeks']
  onSelectDate: (dateKey: string) => void
}) {
  return (
    <View>
      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label) => (
          <Text key={label} style={styles.weekdayCell}>
            {label}
          </Text>
        ))}
      </View>
      {weeks.map((week, weekIndex) => (
        <View key={weekIndex} style={styles.calendarRow}>
          {week.map((cell) =>
            cell.isBlank ? (
              <View key={cell.dateKey} style={styles.calendarCell} />
            ) : (
              <Pressable
                key={cell.dateKey}
                accessibilityRole="button"
                accessibilityLabel={`${cell.dateKey},${cell.count} 张纸页`}
                onPress={() => onSelectDate(cell.dateKey)}
                style={[styles.calendarCell, cell.isSelected && styles.calendarCellSelected]}
              >
                <Text style={{ color: cell.isSelected ? paperColors.action : paperColors.ink }}>
                  {Number(cell.dateKey.slice(8))}
                </Text>
                {cell.count > 0 && (
                  <View
                    style={{
                      height: 3,
                      width: cell.count === 1 ? 8 : cell.count < 5 ? 16 : 24,
                      backgroundColor: paperColors.lineStrong,
                      marginTop: 3,
                    }}
                  />
                )}
              </Pressable>
            ),
          )}
        </View>
      ))}
    </View>
  )
}

function TopicSection({
  vm,
  selectedTopicId,
  onSelectTopic,
  onCreateTopic,
  onViewAll,
}: {
  vm: HomeViewModel
  selectedTopicId: string | null
  onSelectTopic: (topicId: string) => void
  onCreateTopic: () => void
  onViewAll: () => void
}) {
  const visible = vm.topicRows.slice(0, VISIBLE_TOPIC_COUNT)
  const overflow = vm.topicRows.length - visible.length
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>我的主题</Text>
        <Pressable
          accessibilityLabel="新建箱子并打开"
          accessibilityRole="button"
          onPress={onCreateTopic}
          style={styles.sectionAction}
        >
          <Ionicons name="add" size={16} color={paperColors.muted} />
        </Pressable>
      </View>
      {visible.map((row) => (
        <DrawerRow
          key={row.id}
          icon="pricetag-outline"
          label={row.name}
          count={row.count}
          selected={selectedTopicId === row.id}
          onPress={() => onSelectTopic(row.id)}
        />
      ))}
      {overflow > 0 && (
        <Pressable accessibilityRole="button" onPress={onViewAll} style={styles.overflowButton}>
          <Text style={styles.overflowText}>查看全部 {vm.topicRows.length} 个箱子</Text>
        </Pressable>
      )}
    </View>
  )
}

function AttentionSection({
  vm,
  selectedTopicId,
  onSelectTopic,
  onOpenProblems,
}: {
  vm: HomeViewModel
  selectedTopicId: string | null
  onSelectTopic: (topicId: string) => void
  onOpenProblems: () => void
}) {
  return (
    <View>
      <DrawerRow
        icon="file-tray-outline"
        label="待整理"
        count={vm.inboxCount}
        selected={selectedTopicId === INBOX_TOPIC_ID}
        onPress={() => onSelectTopic(INBOX_TOPIC_ID)}
      />
      <DrawerRow
        icon="bulb-outline"
        label="还在思考"
        count={vm.problemCount}
        selected={false}
        onPress={onOpenProblems}
      />
    </View>
  )
}

function DrawerRow({
  icon,
  label,
  count,
  selected,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  count: number
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `${label},${count}` : label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.drawerRow,
        selected && styles.drawerRowSelected,
        pressed && styles.drawerRowPressed,
      ]}
    >
      <Ionicons name={icon} size={24} color={paperColors.action} />
      <Text style={styles.drawerRowLabel}>{label}</Text>
      {count > 0 && (
        <View style={styles.countPill}>
          <Text style={styles.countPillText}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={18} color={paperColors.ink} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: paperColors.selectedSurface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: paperColors.paper,
    borderBottomWidth: 1,
    borderBottomColor: paperColors.line,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: { color: paperColors.ink, fontSize: 18, lineHeight: 26, ...paperTypography.heading },
  headerSpacer: { width: 44 },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  scrim: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: paperColors.scrim,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '88%',
    maxWidth: DRAWER_MAX_WIDTH,
    backgroundColor: paperColors.paper,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: paperColors.line,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  calendarSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: paperColors.line,
  },
  monthSummary: {
    backgroundColor: paperColors.selectedSurface,
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  monthSummaryText: { color: paperColors.action, fontSize: 14, lineHeight: 24 },
  summaryAction: {
    minHeight: 44,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  drawerProfile: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: paperColors.accent,
    borderWidth: 2,
    borderColor: paperColors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: paperColors.ink, fontSize: 13, fontStyle: 'italic', fontWeight: '600' },
  profileName: { color: paperColors.ink, ...typography.subheading, fontWeight: '600' },
  drawerActions: { flexDirection: 'row' },
  monthNav: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  monthLabel: {
    color: paperColors.mutedSoft,
    fontSize: 18,
    lineHeight: 26,
    ...paperTypography.drawer,
    textAlign: 'center',
    marginHorizontal: 2,
  },
  wheelOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    backgroundColor: paperColors.scrim,
  },
  wheelSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: paperColors.paper,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 24,
  },
  wheelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paperColors.line,
  },
  wheelTitle: { color: paperColors.ink, fontSize: 15, fontWeight: '600' },
  wheelApply: { color: paperColors.action, fontSize: 14, fontWeight: '500' },
  wheelPreview: { color: paperColors.muted, fontSize: 12, textAlign: 'center', paddingVertical: 8 },
  wheelColumns: { flexDirection: 'row', height: WHEEL_VISIBLE_ITEMS * WHEEL_ITEM_HEIGHT },
  wheelColumn: { flex: 1, overflow: 'hidden' },
  wheelItem: { height: WHEEL_ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  wheelItemText: { color: paperColors.muted, fontSize: 15 },
  wheelItemTextSelected: { color: paperColors.ink, fontSize: 17, fontWeight: '600' },
  wheelHint: { color: paperColors.mutedFaint, fontSize: 11, textAlign: 'center', paddingTop: 6 },
  weekdayRow: { flexDirection: 'row' },
  weekdayCell: {
    flex: 1,
    textAlign: 'center',
    color: paperColors.muted,
    fontSize: 11,
    paddingVertical: 4,
  },
  calendarRow: { flexDirection: 'row' },
  calendarCell: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  calendarCellSelected: {
    borderWidth: 2,
    borderColor: paperColors.action,
    backgroundColor: paperColors.actionSurface,
  },
  section: {
    marginTop: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: paperColors.line,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  sectionTitle: {
    color: paperColors.action,
    ...typography.bodySmall,
    ...paperTypography.drawer,
    flex: 1,
  },
  sectionAction: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  drawerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  drawerRowSelected: { backgroundColor: paperColors.actionSurfaceStrong },
  drawerRowPressed: { backgroundColor: paperColors.selectedSurface },
  drawerRowLabel: {
    flex: 1,
    color: paperColors.ink,
    ...typography.body,
    ...paperTypography.drawer,
  },
  countPill: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paperColors.lineStrong,
    backgroundColor: lightColors.warningSurface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  countPillText: { color: paperColors.action, fontSize: 11, fontVariant: ['tabular-nums'] },
  overflowButton: { minHeight: 32, justifyContent: 'center', paddingLeft: 30 },
  overflowText: { color: paperColors.muted, fontSize: 11 },
})
