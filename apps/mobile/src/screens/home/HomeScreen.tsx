import { useMemo, useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { paperColors, questionFoldStyle } from '../../features/papers/paper-visual'
import { papersActions, usePapersState } from '../../features/papers/papers-store'
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
const DRAWER_MAX_WIDTH = 280

type Navigation = NativeStackNavigationProp<RootStackParamList>

export function HomeScreen() {
  const state = usePapersState()
  const navigation = useNavigation<Navigation>()
  const insets = useSafeAreaInsets()

  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKeyFromDate(new Date()))
  const [cursor, setCursor] = useState(() => parseDateKey(selectedDateKey))
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerAnim] = useState(() => new Animated.Value(0))

  const vm = useMemo(
    () => buildHomeViewModel(state, selectedDateKey, cursor, selectedTopicId),
    [state, selectedDateKey, cursor, selectedTopicId],
  )

  const openDrawer = () => {
    setDrawerOpen(true)
    Animated.timing(drawerAnim, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }

  const closeDrawer = () => {
    Animated.timing(drawerAnim, {
      toValue: 0,
      duration: 200,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setDrawerOpen(false)
    })
  }

  const openPaper = (paperId: string) => navigation.navigate('PaperDetail', { paperId })

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <HomeHeader title={vm.monthTitle} weekSummary={vm.weekSummary} onOpenDrawer={openDrawer} />
      <WeekStrip days={vm.weekDays} onSelect={(dateKey) => setSelectedDateKey(dateKey)} />
      <Timeline vm={vm} onOpenPaper={openPaper} />
      <Fab onPress={() => navigation.navigate('NoteEditor')} />

      {drawerOpen && (
        <Pressable style={styles.scrim} onPress={closeDrawer} accessibilityLabel="关闭学习抽屉">
          <View />
        </Pressable>
      )}
      {drawerOpen && (
        <Animated.View
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
          <DrawerProfile
            onSearch={() => {
              closeDrawer()
              navigation.navigate('Search')
            }}
            onClose={closeDrawer}
          />
          <MonthNav
            label={vm.monthNavLabel}
            onPrev={() => setCursor(shiftDateKeyCursor(cursor, -1))}
            onNext={() => setCursor(shiftDateKeyCursor(cursor, 1))}
            onOpenReview={() => {
              closeDrawer()
              navigation.navigate('Review')
            }}
          />
          <CalendarGrid
            weeks={vm.monthWeeks}
            onSelectDate={(dateKey) => {
              setSelectedDateKey(dateKey)
              closeDrawer()
            }}
          />
          <Legend />
          <TopicSection
            vm={vm}
            selectedTopicId={selectedTopicId}
            onSelectTopic={(topicId) => {
              setSelectedTopicId(topicId)
              closeDrawer()
            }}
            onViewAll={() => {
              closeDrawer()
              navigation.navigate('Topics')
            }}
          />
          <AttentionSection
            vm={vm}
            selectedTopicId={selectedTopicId}
            onSelectTopic={(topicId) => {
              setSelectedTopicId(topicId)
              closeDrawer()
            }}
            onOpenProblems={() => {
              closeDrawer()
              navigation.navigate('Problems')
            }}
          />
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

function HomeHeader({
  title,
  weekSummary,
  onOpenDrawer,
}: {
  title: string
  weekSummary: string
  onOpenDrawer: () => void
}) {
  return (
    <View style={styles.header}>
      <IconButton name="menu" label="打开学习抽屉" onPress={onOpenDrawer} />
      <View style={styles.headerCenter}>
        <Text style={styles.headerTitle}>{title}</Text>
        <Text style={styles.headerSummary}>本周纸页 · {weekSummary}</Text>
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
}: {
  name: keyof typeof Ionicons.glyphMap
  label: string
  onPress: () => void
  iconSize?: number
  buttonSize?: number
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={8}
      style={[styles.iconButton, { width: buttonSize, height: buttonSize }]}
    >
      <Ionicons name={name} size={iconSize} color={paperColors.ink} />
    </Pressable>
  )
}

function WeekStrip({
  days,
  onSelect,
}: {
  days: HomeViewModel['weekDays']
  onSelect: (dateKey: string) => void
}) {
  return (
    <View style={styles.weekStrip}>
      {days.map((day, index) => (
        <Pressable
          key={day.dateKey}
          accessibilityLabel={`${day.dateKey},${day.count} 张纸页`}
          accessibilityRole="button"
          onPress={() => onSelect(day.dateKey)}
          style={[styles.weekDay, day.isSelected && styles.weekDaySelected]}
        >
          <Text style={styles.weekDayLabel}>{day.isToday ? '今天' : WEEKDAY_LABELS[index]}</Text>
          <View style={styles.paperVisual}>
            {day.count === 0 ? (
              <View style={styles.paperDot} />
            ) : (
              day.stack.map((layer) => (
                <View
                  key={layer}
                  style={[
                    styles.paperSheet,
                    { transform: [{ translateX: -layer * 3 }, { translateY: layer * 3 }] },
                  ]}
                />
              ))
            )}
            {day.hasMore && (
              <View style={styles.stackMore}>
                <Text style={styles.stackMoreText}>3+</Text>
              </View>
            )}
          </View>
        </Pressable>
      ))}
    </View>
  )
}

function Timeline({ vm, onOpenPaper }: { vm: HomeViewModel; onOpenPaper: (id: string) => void }) {
  if (vm.papersOfDate.length === 0) {
    return (
      <View style={styles.emptyDay}>
        <Text style={styles.emptyTitle}>这天还没有纸页</Text>
        <Text style={styles.emptyCopy}>空白只是留白，不是中断。</Text>
      </View>
    )
  }
  return (
    <ScrollView
      contentContainerStyle={[styles.timeline, styles.timelineBody]}
      showsVerticalScrollIndicator={false}
    >
      {vm.papersOfDate.length > 0 && <View style={styles.timelineRailLine} />}
      {vm.papersOfDate.map((entry) => (
        <View key={entry.paper.id} style={styles.timelineEntry}>
          <View style={styles.timelineMarker}>
            <View style={styles.timelineDot} />
          </View>
          <View style={styles.timelineMain}>
            <Text style={styles.timelineTime}>{entry.timeLabel}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${entry.paper.content}${entry.paper.extra.hasQuestion && !entry.paper.extra.isQuestionResolved ? ',仍有未解决的问题' : ''}`}
              onPress={() => onOpenPaper(entry.paper.id)}
              style={({ pressed }) => [
                styles.paperCard,
                { borderLeftColor: entry.topicColor },
                pressed && styles.paperCardPressed,
              ]}
            >
              {entry.paper.extra.hasQuestion && !entry.paper.extra.isQuestionResolved && (
                <View style={questionFoldStyle.fold} aria-label="仍有未解决的问题" />
              )}
              <Text style={styles.paperContent}>{entry.paper.content}</Text>
              <View style={styles.paperMeta}>
                <Text style={styles.paperLabel}>{entry.topicName}</Text>
              </View>
            </Pressable>
          </View>
        </View>
      ))}
    </ScrollView>
  )
}

function Fab({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel="记下一张纸页"
      accessibilityRole="button"
      onPress={onPress}
      style={styles.fab}
    >
      <Ionicons name="add" size={28} color={paperColors.action} />
    </Pressable>
  )
}

function DrawerProfile({ onSearch, onClose }: { onSearch: () => void; onClose: () => void }) {
  return (
    <View style={styles.drawerProfile}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>hi</Text>
      </View>
      <Text style={styles.profileName}>我的学习</Text>
      <View style={styles.drawerActions}>
        <IconButton
          name="search"
          label="搜索纸页与主题"
          onPress={onSearch}
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
  onOpenReview,
}: {
  label: string
  onPrev: () => void
  onNext: () => void
  onOpenReview: () => void
}) {
  return (
    <View style={styles.monthNav}>
      <IconButton
        name="chevron-back"
        label="上一个月"
        onPress={onPrev}
        iconSize={16}
        buttonSize={16}
      />
      <Text style={styles.monthLabel}>{label}</Text>
      <IconButton
        name="chevron-forward"
        label="下一个月"
        onPress={onNext}
        iconSize={16}
        buttonSize={16}
      />
      <View style={styles.monthNavSpacer} />
      <Pressable accessibilityRole="button" onPress={onOpenReview} style={styles.reviewLink}>
        <Text style={styles.reviewLinkText}>查看装订</Text>
        <Ionicons name="chevron-forward" size={12} color={paperColors.muted} />
      </Pressable>
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
                {cell.count > 0 ? (
                  <View style={styles.calendarPaper} />
                ) : (
                  <View style={styles.paperDot} />
                )}
              </Pressable>
            ),
          )}
        </View>
      ))}
      <View style={styles.legend}>
        <Text style={styles.legendText}>少</Text>
        <View style={styles.legendDot} />
        <View style={[styles.legendPaper, { width: 10, height: 13 }]} />
        <View style={[styles.legendPaper, { width: 12, height: 15 }]} />
        <View style={[styles.legendPaper, { width: 14, height: 17 }]} />
        <Text style={styles.legendText}>多</Text>
      </View>
    </View>
  )
}

function Legend() {
  return null
}

function TopicSection({
  vm,
  selectedTopicId,
  onSelectTopic,
  onViewAll,
}: {
  vm: HomeViewModel
  selectedTopicId: string | null
  onSelectTopic: (topicId: string) => void
  onViewAll: () => void
}) {
  const visible = vm.topicRows.slice(0, VISIBLE_TOPIC_COUNT)
  const overflow = vm.topicRows.length - visible.length
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>我的箱子</Text>
        <Pressable
          accessibilityLabel="快速新建未命名箱子"
          accessibilityRole="button"
          onPress={() => papersActions.createTopic(`未命名的知识 ${vm.topicRows.length + 1}`)}
          style={styles.sectionAction}
        >
          <Ionicons name="add" size={16} color={paperColors.muted} />
        </Pressable>
      </View>
      {visible.map((row) => (
        <DrawerRow
          key={row.id}
          icon="archive-outline"
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
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>需要留意</Text>
      </View>
      <DrawerRow
        icon="file-tray-outline"
        label="待整理的纸页"
        count={vm.inboxCount}
        selected={selectedTopicId === INBOX_TOPIC_ID}
        onPress={() => onSelectTopic(INBOX_TOPIC_ID)}
      />
      <DrawerRow
        icon="bulb-outline"
        label="还在思考的问题"
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
      accessibilityLabel={`${label},${count}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.drawerRow,
        selected && styles.drawerRowSelected,
        pressed && styles.drawerRowPressed,
      ]}
    >
      <Ionicons name={icon} size={16} color={paperColors.muted} />
      <Text style={styles.drawerRowLabel}>{label}</Text>
      <View style={styles.countPill}>
        <Text style={styles.countPillText}>{count > 99 ? '99+' : count}</Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: paperColors.paper },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, marginTop: 4 },
  headerCenter: { flex: 1, alignItems: 'center', gap: 2 },
  headerTitle: { color: paperColors.ink, fontSize: 18, fontWeight: '600' },
  headerSummary: { color: paperColors.muted, fontSize: 12 },
  headerSpacer: { width: 44 },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  weekStrip: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginTop: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paperColors.line,
    paddingBottom: 10,
  },
  weekDay: { flex: 1, alignItems: 'center', paddingTop: 6, paddingBottom: 6, borderRadius: 10 },
  weekDaySelected: { backgroundColor: paperColors.selectedSurface },
  weekDayLabel: { color: paperColors.muted, fontSize: 11, fontWeight: '500' },
  paperVisual: {
    width: 30,
    height: 28,
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paperSheet: {
    position: 'absolute',
    width: 16,
    height: 20,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: paperColors.lineStrong,
    backgroundColor: paperColors.paper,
  },
  paperDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: paperColors.mutedFaint },
  stackMore: {
    position: 'absolute',
    top: -4,
    right: 0,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: paperColors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  stackMoreText: { color: paperColors.paper, fontSize: 8, lineHeight: 14 },
  timeline: { flex: 1, paddingTop: 6, paddingHorizontal: 16, paddingBottom: 96 },
  timelineBody: { position: 'relative' },
  timelineRailLine: {
    position: 'absolute',
    left: 21,
    top: 8,
    bottom: 30,
    width: 2,
    backgroundColor: paperColors.timeline,
  },
  timelineEntry: { flexDirection: 'row', marginBottom: 20 },
  timelineMarker: { width: 12, alignItems: 'center' },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: paperColors.action,
    backgroundColor: paperColors.paper,
    marginTop: 2,
  },
  timelineMain: { flex: 1, paddingLeft: 8 },
  timelineTime: { color: paperColors.muted, fontSize: 12, marginBottom: 6 },
  paperCard: {
    flex: 1,
    minHeight: 66,
    backgroundColor: paperColors.surfaceSoft,
    borderColor: paperColors.line,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
    borderRadius: 8,
    padding: 12,
    overflow: 'hidden',
  },
  paperCardPressed: { backgroundColor: paperColors.selectedSurface },
  paperContent: { color: paperColors.ink, fontSize: 14, lineHeight: 21, paddingRight: 4 },
  paperMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  paperLabel: { color: paperColors.muted, fontSize: 11 },
  paperHint: { color: paperColors.action, fontSize: 11, fontWeight: '500' },
  emptyDay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { color: paperColors.ink, fontSize: 16, fontWeight: '600' },
  emptyCopy: { color: paperColors.muted, fontSize: 13, marginTop: 8 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: paperColors.actionSurface,
    borderColor: paperColors.lineStrong,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: paperColors.ink,
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
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
    width: '72%',
    maxWidth: DRAWER_MAX_WIDTH,
    backgroundColor: paperColors.paper,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: paperColors.line,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  drawerProfile: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: paperColors.accent,
    borderWidth: 2,
    borderColor: paperColors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: paperColors.ink, fontSize: 13, fontStyle: 'italic', fontWeight: '600' },
  profileName: { color: paperColors.ink, fontSize: 14, fontWeight: '500', flex: 1 },
  drawerActions: { flexDirection: 'row' },
  monthNav: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  monthLabel: { color: paperColors.ink, fontSize: 14, fontWeight: '500', marginHorizontal: 2 },
  monthNavSpacer: { flex: 1 },
  reviewLink: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 4 },
  reviewLinkText: { color: paperColors.muted, fontSize: 12 },
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
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  calendarCellSelected: {
    borderWidth: 2,
    borderColor: paperColors.action,
    backgroundColor: paperColors.actionSurface,
  },
  calendarPaper: {
    width: 16,
    height: 20,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: paperColors.lineStrong,
    backgroundColor: paperColors.paper,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 5,
    marginTop: 6,
  },
  legendText: { color: paperColors.muted, fontSize: 10 },
  legendDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: paperColors.mutedFaint },
  legendPaper: {
    borderRadius: 2,
    borderWidth: 1,
    borderColor: paperColors.lineStrong,
    backgroundColor: paperColors.paper,
  },
  section: { marginTop: 10 },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  sectionTitle: { color: paperColors.mutedSoft, fontSize: 12, flex: 1 },
  sectionAction: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  drawerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    borderRadius: 10,
    paddingHorizontal: 2,
  },
  drawerRowSelected: { backgroundColor: paperColors.actionSurfaceStrong },
  drawerRowPressed: { backgroundColor: paperColors.selectedSurface },
  drawerRowLabel: { flex: 1, color: paperColors.ink, fontSize: 13 },
  countPill: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paperColors.lineStrong,
    backgroundColor: paperColors.actionSurfaceStrong,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  countPillText: { color: paperColors.action, fontSize: 11, fontVariant: ['tabular-nums'] },
  overflowButton: { minHeight: 32, justifyContent: 'center', paddingLeft: 30 },
  overflowText: { color: paperColors.muted, fontSize: 11 },
})
