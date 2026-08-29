import { Ionicons } from '@expo/vector-icons'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { paperColors } from '../../features/papers/paper-visual'
import { usePapersState } from '../../features/papers/papers-store'

/** 月份装订:这个月的散页,正在成为一本可以重新翻阅的学习册。 */
export function ReviewScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const state = usePapersState()

  const papers = state.papers.filter((paper) => !paper.deletedAt)
  const resolvedCount = papers.filter((paper) => {
    const extra = state.extras[paper.id]
    return extra?.hasQuestion && extra.isQuestionResolved
  }).length
  const now = new Date()
  const monthLabel = `${now.getFullYear()} 年 ${now.getMonth() + 1} 月`

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
        <Text style={styles.title}>{monthLabel}装订</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.book}>
          <Text style={styles.bookKicker}>{monthLabel}</Text>
          <Text style={styles.bookTitle}>学习装订</Text>
          <Text style={styles.bookCopy}>
            理解不是一次完成的，它在记录、整理与追问之间慢慢变厚。
          </Text>
        </View>
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{papers.length}</Text>
            <Text style={styles.statLabel}>纸页</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{state.topics.length}</Text>
            <Text style={styles.statLabel}>主题</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{resolvedCount}</Text>
            <Text style={styles.statLabel}>解决</Text>
          </View>
        </View>
      </ScrollView>
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
  body: { padding: 20, gap: 24 },
  book: {
    backgroundColor: paperColors.action,
    borderRadius: 16,
    padding: 28,
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
  statValue: { color: paperColors.ink, fontSize: 26, fontWeight: '600' },
  statLabel: { color: paperColors.muted, fontSize: 12 },
})
