import { useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { radii, sizes, spacing, typography } from '@studycommit/design-tokens'
import { paperColors as colors } from '../../features/papers/paper-visual'
import { usePapersState } from '../../features/papers/papers-store'
import type { RootStackParamList } from '../../navigation/navigation.types'

export function CollectionScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'Collection'>>()
  return <PaperCollection mode={route.params.mode} topicId={route.params.topicId} />
}

export function PaperCollection({
  mode,
  topicId,
}: {
  mode: 'box' | 'inbox' | 'questions'
  topicId?: string
}) {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const state = usePapersState()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState(mode === 'questions' ? 'open' : 'all')
  const topic = state.topics.find((item) => item.id === topicId)
  const title =
    mode === 'questions'
      ? '还在思考的问题'
      : mode === 'inbox'
        ? '待整理的纸页'
        : (topic?.name ?? '箱子不存在')
  const papers = state.papers.filter(
    (paper) =>
      !paper.deletedAt &&
      (mode === 'questions'
        ? state.extras[paper.id]?.hasQuestion
        : mode === 'inbox'
          ? paper.status === 'inbox'
          : paper.topicId === topicId),
  )
  const visible = papers
    .filter((paper) => paper.content.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .filter(
      (paper) =>
        filter === 'all' ||
        (filter === 'open'
          ? state.extras[paper.id]?.hasQuestion && !state.extras[paper.id]?.isQuestionResolved
          : state.extras[paper.id]?.isQuestionResolved),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const filters =
    mode === 'questions'
      ? [
          ['open', '还在思考'],
          ['resolved', '已经弄懂'],
          ['all', '全部'],
        ]
      : [
          ['all', '全部纸页'],
          ['open', '还在思考'],
        ]
  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回上一页"
          onPress={() => navigation.goBack()}
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <Text style={styles.barTitle}>{mode === 'box' ? '我的箱子' : '学习抽屉'}</Text>
        <View style={styles.back} />
      </View>
      <FlatList
        data={visible}
        keyExtractor={(paper) => paper.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.xl }]}
        ListHeaderComponent={
          <View>
            <View style={styles.heading}>
              <Ionicons
                name={
                  mode === 'box'
                    ? 'file-tray-outline'
                    : mode === 'inbox'
                      ? 'documents-outline'
                      : 'help-circle-outline'
                }
                size={sizes.iconLg}
                color={colors.action}
              />
              <Text accessibilityRole="header" style={styles.title}>
                {title}
              </Text>
            </View>
            <Text style={styles.description}>
              {mode === 'questions'
                ? '不急着得到所有答案，从一个问题开始。'
                : mode === 'inbox'
                  ? '先记下来就很好，再慢慢找到归属。'
                  : '收好的纸页，正在慢慢成为你的理解。'}
            </Text>
            <View style={styles.search}>
              <Ionicons name="search-outline" size={20} color={colors.action} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                accessibilityLabel="搜索当前页面的纸页"
                placeholder="找一张纸页…"
                placeholderTextColor={colors.action}
                style={styles.input}
                clearButtonMode="while-editing"
              />
            </View>
            <View style={styles.filters}>
              {filters.map(([value, label]) => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: filter === value }}
                  onPress={() => setFilter(value)}
                  style={[styles.filter, filter === value && styles.filterSelected]}
                >
                  <Text style={[styles.filterText, filter === value && styles.filterTextSelected]}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.listMeta}>
              <Text style={styles.order}>
                {visible.length} {mode === 'questions' ? '个问题' : '张纸页'}
              </Text>
              <Text style={styles.order}>最近记录在前</Text>
            </View>
          </View>
        }
        renderItem={({ item: paper }) => {
          const extra = state.extras[paper.id]
          const open = extra?.hasQuestion && !extra.isQuestionResolved
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${paper.content}，${open ? '还在思考，' : ''}查看纸页`}
              onPress={() => navigation.navigate('PaperDetail', { paperId: paper.id })}
              style={({ pressed }) => [styles.paper, pressed && styles.pressed]}
            >
              {open && <View pointerEvents="none" style={styles.fold} />}
              <View style={styles.paperMeta}>
                <Text style={styles.meta}>
                  {new Date(paper.createdAt).toLocaleDateString('zh-CN', {
                    month: 'long',
                    day: 'numeric',
                  })}
                </Text>
                {extra?.hasQuestion && (
                  <Text style={styles.state}>{open ? '还在思考' : '已经弄懂'}</Text>
                )}
              </View>
              <Text numberOfLines={4} style={styles.content}>
                {paper.content}
              </Text>
              <View style={styles.paperFoot}>
                <Text style={styles.topic}>
                  {state.topics.find((box) => box.id === paper.topicId)?.name ?? '待整理'}
                </Text>
                <Text style={[styles.link, mode === 'inbox' && styles.organizeLink]}>
                  {mode === 'inbox' ? '查看并整理' : open ? '继续弄懂' : '打开纸页'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.action} />
              </View>
            </Pressable>
          )
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="documents-outline" size={40} color={colors.action} />
            <Text style={styles.emptyTitle}>
              {papers.length
                ? '没有符合条件的纸页'
                : mode === 'inbox'
                  ? '纸页都收好了'
                  : '这里还有空白'}
            </Text>
            <Text style={styles.description}>
              {papers.length ? '试试其他关键词，或查看全部纸页。' : '不必着急，留给下一次发现。'}
            </Text>
            {papers.length > 0 && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setQuery('')
                  setFilter('all')
                }}
                style={styles.filter}
              >
                <Text style={styles.link}>清除筛选</Text>
              </Pressable>
            )}
          </View>
        }
        ListFooterComponent={
          <Text style={styles.demo}>本地示例工作区 · 变更仅在本次运行中保存</Text>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.canvas },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
  },
  back: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  barTitle: { ...typography.bodySmall, color: colors.action },
  list: { paddingHorizontal: spacing.lg, flexGrow: 1 },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smPlus,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  title: { ...typography.heading, fontWeight: '600', color: colors.ink, flex: 1 },
  description: {
    ...typography.bodySmall,
    lineHeight: typography.body.lineHeight,
    color: colors.action,
    marginTop: spacing.sm,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.smPlus,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    backgroundColor: colors.paper,
  },
  input: { ...typography.bodySmall, flex: 1, minHeight: 48, color: colors.ink },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  filter: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  filterSelected: { borderBottomColor: colors.action },
  filterTextSelected: { fontWeight: '600' },
  listMeta: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  filterText: { ...typography.bodySmall, color: colors.ink },
  order: { ...typography.caption, color: colors.action, marginVertical: spacing.md },
  paper: {
    backgroundColor: colors.paper,
    padding: spacing.md,
    borderRadius: radii.sm,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  pressed: { backgroundColor: colors.selectedSurface },
  fold: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 0,
    height: 0,
    borderLeftWidth: spacing.md,
    borderTopWidth: spacing.md,
    borderLeftColor: 'transparent',
    borderTopColor: colors.accent,
  },
  organizeLink: { fontWeight: '600' },
  paperMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  meta: { ...typography.caption, color: colors.action },
  state: {
    ...typography.caption,
    color: colors.action,
    paddingVertical: spacing.xs,
  },
  content: {
    ...typography.body,
    lineHeight: typography.subheading.lineHeight,
    color: colors.ink,
    marginVertical: spacing.md,
  },
  paperFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
    paddingTop: spacing.smPlus,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  topic: { ...typography.caption, color: colors.action, flex: 1 },
  link: { ...typography.caption, color: colors.action },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyTitle: { ...typography.subheading, color: colors.ink, marginTop: spacing.md },
  demo: {
    ...typography.caption,
    color: colors.action,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
})
