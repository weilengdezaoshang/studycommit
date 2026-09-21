import { PuzzleEntry } from '../../features/puzzle/PuzzleEntry'
import { paperTypography } from '../../theme/paper-typography'
import { useMemo, useState } from 'react'
import { NotebookPaper } from './NotebookPaper'
import peekingCat from '../../../assets/notebook/peeking-cat.png'
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { spacing, typography, radii, motion, lightColors } from '@studycommit/design-tokens'
import { PaperTransition } from '../../components/PaperTransition'
import { paperColors as colors } from '../../features/papers/paper-visual'
import type { HomeViewModel } from '../../features/papers/view-model'
import { INBOX_TOPIC_ID } from '../../features/papers/view-model'
import type { PaperWithExtra } from '../../navigation/navigation.types'

export function Notebook({
  vm,
  date,
  topicId,
  bottom,
  onClear,
  onCreate,
  showCreate = true,
  onOpen,
  onExplain,
}: {
  vm: HomeViewModel
  date: string | null
  topicId: string | null
  bottom: number
  onClear: () => void
  showCreate?: boolean
  onCreate: () => void
  onOpen: (id: string) => void
  onExplain: (id: string) => void
}) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [oldest, setOldest] = useState(false)
  const [questionsOnly, setQuestionsOnly] = useState(false)
  const groups = useMemo(() => {
    const byDate = new Map<string, PaperWithExtra[]>()
    const papers = Array.from(vm.paperById.values())
      .filter(
        (p) =>
          (!date || p.createdAt.slice(0, 10) === date) &&
          (!topicId ||
            (topicId === INBOX_TOPIC_ID ? p.status === 'inbox' : p.topicId === topicId)) &&
          (!questionsOnly || (p.extra.hasQuestion && !p.extra.isQuestionResolved)),
      )
      .sort((a, b) =>
        oldest ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt),
      )
    for (const paper of papers) {
      const key = paper.createdAt.slice(0, 10)
      byDate.set(key, [...(byDate.get(key) ?? []), paper])
    }
    return Array.from(byDate, ([key, papers]) => ({ key, papers }))
  }, [vm.paperById, date, topicId, questionsOnly, oldest])
  const count = groups.reduce((sum, group) => sum + group.papers.length, 0)
  const scope =
    date ??
    (topicId === INBOX_TOPIC_ID ? '待整理' : vm.topicRows.find((t) => t.id === topicId)?.name) ??
    '全部记录'
  return (
    <View style={s.container}>
      <View style={s.heading}>
        <View>
          <Text accessibilityRole="header" style={s.title}>
            记录本
          </Text>
          <View style={s.underline} />
        </View>
        <PuzzleEntry />
        {showCreate && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="记下一张纸页"
            onPress={onCreate}
            style={({ pressed }) => [s.create, pressed && s.pressed]}
          >
            <Ionicons name="add" size={22} color={colors.ink} />
            <Text style={s.createText}>记一点</Text>
          </Pressable>
        )}
      </View>
      <View style={s.toolbar}>
        <Text numberOfLines={1} style={s.scope}>
          {scope} · {count} 条
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: filtersOpen }}
          onPress={() => setFiltersOpen(!filtersOpen)}
          style={s.filterButton}
        >
          <Ionicons name="options-outline" size={18} color={colors.action} />
          <Text style={s.caption}>筛选与排序</Text>
        </Pressable>
      </View>
      {filtersOpen && (
        <View style={s.filters}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: questionsOnly }}
            onPress={() => setQuestionsOnly(!questionsOnly)}
            style={s.filterButton}
          >
            <Text style={s.caption}>{questionsOnly ? '✓ ' : ''}只看还在思考</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setOldest(!oldest)}
            style={s.filterButton}
          >
            <Text style={s.caption}>{oldest ? '从早到晚 ↑' : '从新到旧 ↓'}</Text>
          </Pressable>
        </View>
      )}
      {(date || topicId || questionsOnly) && (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            onClear()
            setQuestionsOnly(false)
          }}
          style={s.clear}
        >
          <Text style={s.caption}>清除筛选，查看全部记录 ×</Text>
        </Pressable>
      )}
      <FlatList
        data={groups}
        keyExtractor={(group) => group.key}
        contentContainerStyle={[s.list, { paddingBottom: bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="book-outline" size={40} color={colors.lineStrong} />
            <Text style={s.emptyTitle}>这里还没有记录</Text>
            <Text style={s.caption}>空白只是留白，记一点新的想法吧。</Text>
          </View>
        }
        renderItem={({ item: group, index }) => (
          <PaperTransition style={s.dayWrap}>
            {index === 0 && (
              <Image accessible={false} source={peekingCat} style={s.cat} resizeMode="contain" />
            )}
            <NotebookPaper>
              <View style={s.dateHeading}>
                <Text style={s.dateNumber}>{group.key.slice(8)}</Text>
                <Text style={s.dateLabel}>
                  {Number(group.key.slice(5, 7))}月 ·{' '}
                  {
                    ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][
                      new Date(`${group.key}T12:00:00`).getDay()
                    ]
                  }
                </Text>
                <Text style={s.caption}>{group.papers.length} 条记录</Text>
              </View>
              {group.papers.map((paper, paperIndex) => (
                <View
                  key={paper.id}
                  style={[
                    s.entry,
                    paperIndex === group.papers.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <View style={s.rail}>
                    <View style={s.dot} />
                  </View>
                  <View style={s.entryBody}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={paper.content}
                      onPress={() => onOpen(paper.id)}
                      style={({ pressed }) => pressed && s.pressed}
                    >
                      <Text style={s.time}>
                        {new Date(paper.createdAt).toLocaleTimeString('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                        })}
                      </Text>
                      <Text numberOfLines={4} style={s.content}>
                        {paper.content || `图片记录 · ${paper.assets?.length ?? 0} 张`}
                      </Text>
                    </Pressable>
                    <View style={s.meta}>
                      <Text numberOfLines={1} style={s.tag}>
                        # {vm.topicRows.find((t) => t.id === paper.topicId)?.name ?? '待整理'}
                      </Text>
                      {paper.extra.hasQuestion && !paper.extra.isQuestionResolved && (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`弄懂：${paper.content}`}
                          onPress={() => onExplain(paper.id)}
                          style={s.explain}
                        >
                          <Text style={s.question}>还在思考</Text>
                          <Text style={s.caption}>弄懂 ↗</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                </View>
              ))}
            </NotebookPaper>
          </PaperTransition>
        )}
      />
    </View>
  )
}
const s = StyleSheet.create({
  container: { flex: 1 },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: { ...typography.title, color: colors.ink, ...paperTypography.heading, letterSpacing: 1 },
  underline: {
    height: 5,
    backgroundColor: colors.actionSurfaceStrong,
    borderRadius: radii.sm,
    transform: [{ rotate: '-2deg' }],
  },
  create: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.actionSurface,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radii.sm,
  },
  createText: { ...typography.body, color: colors.ink, ...paperTypography.heading },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  scope: { ...typography.bodySmall, flex: 1, color: colors.ink },
  caption: { ...typography.caption, color: colors.action },
  filterButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  filters: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    backgroundColor: colors.actionSurface,
  },
  clear: { paddingHorizontal: spacing.md, minHeight: 44, justifyContent: 'center' },
  list: { paddingHorizontal: spacing.md, paddingTop: 60, flexGrow: 1 },
  dayWrap: { marginBottom: spacing.lg },
  cat: { position: 'absolute', width: 130, height: 86, right: spacing.md, top: -62, zIndex: 1 },
  dateHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  dateNumber: { ...typography.title, fontStyle: 'italic', color: colors.ink },
  dateLabel: { ...typography.bodySmall, color: colors.ink, flex: 1 },
  entry: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rail: { width: 12, borderLeftWidth: 1, borderLeftColor: colors.line, marginTop: spacing.xs },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.action, marginLeft: -4 },
  entryBody: { flex: 1 },
  time: { ...typography.caption, color: colors.muted, marginBottom: spacing.xs },
  content: { ...typography.body, color: colors.ink },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  tag: {
    ...typography.caption,
    color: colors.action,
    backgroundColor: colors.actionSurface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    maxWidth: '100%',
  },
  explain: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  question: {
    ...typography.caption,
    color: colors.ink,
    backgroundColor: lightColors.warningSurface,
    padding: spacing.xs,
    borderRadius: radii.sm,
  },
  pressed: { opacity: motion.pressedOpacity },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.md },
  emptyTitle: { ...typography.subheading, color: colors.ink },
})
