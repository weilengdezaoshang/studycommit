import { paperTypography } from '../../theme/paper-typography'
import { useState } from 'react'
import { spacing, radii, typography } from '@studycommit/design-tokens'
import { PaperTransition } from '../../components/PaperTransition'
import { Ionicons } from '@expo/vector-icons'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useDialog } from '../../components'
import { PaperEmptyIllustration } from '../../features/papers/paper-empty-illustration'
import { paperColors } from '../../features/papers/paper-visual'
import { papersActions, usePapersState } from '../../features/papers/papers-store'

/** 我的主题:创建、切换与管理都位于学习抽屉的延伸面板。 */
export function TopicsScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const state = usePapersState()
  const dialog = useDialog()
  const [menu, setMenu] = useState<string | null>(null)

  const openCreateDialog = () => {
    dialog.show({
      title: '新建主题',
      field: { label: '主题名称', defaultValue: '', maxLength: 18, required: true },
      confirmLabel: '创建',
      confirmBusyLabel: '创建中',
      onConfirm: async ({ fieldValue }) => {
        await papersActions.createTopic(fieldValue ?? '')
      },
    })
  }

  const openRenameDialog = (topicId: string, currentName: string) => {
    dialog.show({
      title: '重命名主题',
      field: {
        label: '主题名称',
        defaultValue: currentName,
        maxLength: 18,
        required: true,
      },
      confirmLabel: '保存',
      confirmBusyLabel: '同步中',
      onConfirm: async ({ fieldValue }) => {
        await papersActions.renameTopic(topicId, fieldValue ?? '')
      },
    })
  }

  const openDeleteDialog = (topicId: string, topicName: string) => {
    dialog.show({
      title: '删除主题',
      description: `删除“${topicName}”后，里面的纸页会移回待整理。`,
      confirmLabel: '删除',
      confirmBusyLabel: '同步中',
      onConfirm: () => papersActions.deleteTopic(topicId),
    })
  }

  return (
    <PaperTransition style={styles.page}>
      <View style={[styles.topBar, { paddingTop: insets.top + 4 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="关闭主题列表"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={22} color={paperColors.ink} />
        </Pressable>
        <Text style={styles.title}>我的主题</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="新建主题"
          onPress={openCreateDialog}
          style={styles.backButton}
        >
          <Ionicons name="add" size={22} color={paperColors.muted} />
        </Pressable>
      </View>

      <Text style={styles.heading}>我的主题</Text>
      <Text style={styles.summary}>{state.topics.length} 个主题 · 当前已加载的记录</Text>
      {state.topics.length > 0 ? (
        <ScrollView contentContainerStyle={styles.list}>
          {state.topics.map((topic) => {
            const records = state.papers.filter(
              (paper) => paper.topicId === topic.id && !paper.deletedAt,
            )
            const count = records.length
            return (
              <View key={topic.id} style={styles.row}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${topic.name},${count} 张纸页`}
                  onPress={() =>
                    navigation.navigate('Collection', { mode: 'box', topicId: topic.id })
                  }
                  style={styles.rowMain}
                >
                  <Ionicons name="folder-outline" size={28} color={paperColors.action} />
                  <View style={styles.topicText}>
                    <Text style={styles.rowLabel}>{topic.name}</Text>
                    <Text numberOfLines={2} style={styles.excerpt}>
                      {records.at(-1)?.content ?? '还没有记录'}
                    </Text>
                  </View>
                  <View style={styles.countPill}>
                    <Text style={styles.countText}>{count}</Text>
                  </View>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`管理主题${topic.name}`}
                  onPress={() => setMenu(menu === topic.id ? null : topic.id)}
                  style={styles.actionButton}
                >
                  <Ionicons name="ellipsis-horizontal" size={20} color={paperColors.muted} />
                </Pressable>
                {menu === topic.id && (
                  <View style={styles.menu}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        setMenu(null)
                        openRenameDialog(topic.id, topic.name)
                      }}
                      style={styles.actionButton}
                    >
                      <Text>重命名</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        setMenu(null)
                        openDeleteDialog(topic.id, topic.name)
                      }}
                      style={styles.actionButton}
                    >
                      <Text>删除主题</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )
          })}
        </ScrollView>
      ) : (
        <View style={styles.empty}>
          <PaperEmptyIllustration />
          <Text style={styles.emptyTitle}>还没有主题</Text>
          <Text style={styles.emptyCopy}>点击右上角创建第一个主题。</Text>
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate('Collection', { mode: 'inbox' })}
        style={styles.inbox}
      >
        <Text style={styles.excerpt}>
          待整理 · {state.papers.filter((paper) => !paper.deletedAt && !paper.topicId).length}{' '}
          条记录 →
        </Text>
      </Pressable>
      {dialog.dialog}
    </PaperTransition>
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
  title: { color: paperColors.muted, fontSize: 14, fontWeight: '500' },
  heading: {
    ...paperTypography.heading,
    ...typography.title,
    color: paperColors.ink,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  summary: {
    ...typography.bodySmall,
    color: paperColors.muted,
    paddingHorizontal: spacing.lg,
    marginVertical: spacing.md,
  },
  list: {
    padding: spacing.md,
    marginHorizontal: spacing.md,
    backgroundColor: paperColors.paper,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paperColors.lineStrong,
    borderRadius: radii.md,
  },
  topicText: { flex: 1, gap: spacing.sm },
  excerpt: { ...typography.bodySmall, color: paperColors.muted },
  menu: {
    position: 'absolute',
    right: spacing.sm,
    top: 44,
    zIndex: 2,
    backgroundColor: paperColors.actionSurface,
    borderRadius: radii.sm,
    padding: spacing.sm,
  },
  inbox: { padding: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 132,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paperColors.line,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  actionButton: { minWidth: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  boxIcon: { width: 18, height: 18, borderRadius: 4 },
  rowLabel: { flex: 1, color: paperColors.ink, fontSize: 15 },
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
  countText: { color: paperColors.action, fontSize: 11, fontVariant: ['tabular-nums'] },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyTitle: { color: paperColors.muted, fontSize: 15 },
  emptyCopy: { color: paperColors.muted, fontSize: 12 },
})
