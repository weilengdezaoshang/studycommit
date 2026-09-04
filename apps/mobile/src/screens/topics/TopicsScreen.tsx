import { Ionicons } from '@expo/vector-icons'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useDialog } from '../../components'
import { PaperEmptyIllustration } from '../../features/papers/paper-empty-illustration'
import { paperColors } from '../../features/papers/paper-visual'
import { papersActions, usePapersState } from '../../features/papers/papers-store'

/** 全部箱子:创建、切换与管理都位于学习抽屉的延伸面板。 */
export function TopicsScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const state = usePapersState()
  const dialog = useDialog()

  const openCreateDialog = () => {
    dialog.show({
      title: '新建箱子',
      field: { label: '箱子名称', defaultValue: '', maxLength: 18, required: true },
      confirmLabel: '创建',
      confirmBusyLabel: '创建中',
      onConfirm: async ({ fieldValue }) => {
        await papersActions.createTopic(fieldValue ?? '')
      },
    })
  }

  const openRenameDialog = (topicId: string, currentName: string) => {
    dialog.show({
      title: '重命名箱子',
      field: {
        label: '箱子名称',
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
      title: '删除箱子',
      description: `删除“${topicName}”后，里面的纸页会移回待整理。`,
      confirmLabel: '删除',
      confirmBusyLabel: '同步中',
      onConfirm: () => papersActions.deleteTopic(topicId),
    })
  }

  return (
    <View style={styles.page}>
      <View style={[styles.topBar, { paddingTop: insets.top + 4 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="关闭箱子列表"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={22} color={paperColors.ink} />
        </Pressable>
        <Text style={styles.title}>全部箱子</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="新建箱子"
          onPress={openCreateDialog}
          style={styles.backButton}
        >
          <Ionicons name="add" size={22} color={paperColors.muted} />
        </Pressable>
      </View>

      {state.topics.length > 0 ? (
        <ScrollView contentContainerStyle={styles.list}>
          {state.topics.map((topic) => {
            const count = state.papers.filter(
              (paper) => paper.topicId === topic.id && !paper.deletedAt,
            ).length
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
                  <View style={[styles.boxIcon, { backgroundColor: topic.color }]} />
                  <Text style={styles.rowLabel}>{topic.name}</Text>
                  <View style={styles.countPill}>
                    <Text style={styles.countText}>{count}</Text>
                  </View>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`重命名箱子${topic.name}`}
                  onPress={() => openRenameDialog(topic.id, topic.name)}
                  style={styles.actionButton}
                >
                  <Ionicons name="pencil-outline" size={18} color={paperColors.muted} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`删除箱子${topic.name}`}
                  onPress={() => openDeleteDialog(topic.id, topic.name)}
                  style={styles.actionButton}
                >
                  <Ionicons name="trash-outline" size={18} color={paperColors.muted} />
                </Pressable>
              </View>
            )
          })}
        </ScrollView>
      ) : (
        <View style={styles.empty}>
          <PaperEmptyIllustration />
          <Text style={styles.emptyTitle}>还没有箱子</Text>
          <Text style={styles.emptyCopy}>点击右上角创建第一个箱子。</Text>
        </View>
      )}
      {dialog.dialog}
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
  list: { padding: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paperColors.line,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  actionButton: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
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
