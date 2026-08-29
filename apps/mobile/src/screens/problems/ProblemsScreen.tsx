import { Ionicons } from '@expo/vector-icons'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { paperColors } from '../../features/papers/paper-visual'
import { usePapersState } from '../../features/papers/papers-store'

/** 还在思考的问题:问题不是任务,没有截止时间和失败状态。 */
export function ProblemsScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const state = usePapersState()

  const problems = state.papers.filter((paper) => {
    if (paper.deletedAt) {
      return false
    }
    const extra = state.extras[paper.id]
    return extra?.hasQuestion && !extra.isQuestionResolved
  })

  return (
    <View style={styles.page}>
      <View style={[styles.topBar, { paddingTop: insets.top + 4 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="关闭问题"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={22} color={paperColors.ink} />
        </Pressable>
        <Text style={styles.title}>还在思考的问题</Text>
        <View style={styles.backButton} />
      </View>

      {problems.length > 0 ? (
        <ScrollView contentContainerStyle={styles.list}>
          {problems.map((paper) => (
            <Pressable
              key={paper.id}
              accessibilityRole="button"
              onPress={() => navigation.navigate('PaperDetail', { paperId: paper.id })}
              style={styles.item}
            >
              <Text style={styles.itemDate}>{paper.createdAt.slice(0, 10)}</Text>
              <Text style={styles.itemContent}>{paper.content}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>暂时没有未解决的问题</Text>
          <Text style={styles.emptyCopy}>记录时可以主动标记问题，之后再回来继续弄懂。</Text>
        </View>
      )}
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
  list: { padding: 20, gap: 12 },
  item: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paperColors.line,
    paddingBottom: 14,
    gap: 6,
  },
  itemDate: { color: paperColors.action, fontSize: 12 },
  itemContent: { color: paperColors.ink, fontSize: 14, lineHeight: 21 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  emptyTitle: { color: paperColors.muted, fontSize: 15 },
  emptyCopy: {
    color: paperColors.mutedFaint ?? paperColors.muted,
    fontSize: 12,
    textAlign: 'center',
  },
})
