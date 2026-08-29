import { useMemo, useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PaperEmptyIllustration } from '../../features/papers/paper-empty-illustration'
import { paperColors } from '../../features/papers/paper-visual'
import { usePapersState } from '../../features/papers/papers-store'

type SearchResult = { type: 'paper' | 'topic'; id: string; title: string; detail: string }

/** 搜索纸页与箱子:入口在抽屉顶部,首页顶栏不展示搜索。 */
export function SearchScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const state = usePapersState()
  const [query, setQuery] = useState('')

  const results = useMemo<SearchResult[]>(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) {
      return []
    }
    const paperResults = state.papers
      .filter((paper) => !paper.deletedAt && paper.content.toLowerCase().includes(keyword))
      .slice(0, 10)
      .map((paper) => ({
        type: 'paper' as const,
        id: paper.id,
        title: paper.createdAt.slice(0, 10),
        detail: paper.content,
      }))
    const topicResults = state.topics
      .filter((topic) => topic.name.toLowerCase().includes(keyword))
      .slice(0, 10)
      .map((topic) => ({
        type: 'topic' as const,
        id: topic.id,
        title: topic.name,
        detail: `${state.papers.filter((paper) => paper.topicId === topic.id).length} 张纸页 · 主题`,
      }))
    return [...topicResults, ...paperResults]
  }, [query, state])

  return (
    <View style={styles.page}>
      <View style={[styles.topBar, { paddingTop: insets.top + 4 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="关闭搜索"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={22} color={paperColors.ink} />
        </Pressable>
        <Text style={styles.title}>搜索</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.fieldRow}>
        <TextInput
          style={styles.input}
          autoFocus
          placeholder="搜索纸页与主题"
          placeholderTextColor={paperColors.mutedFaint ?? paperColors.muted}
          value={query}
          onChangeText={setQuery}
        />
        {query.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="清空搜索关键词"
            onPress={() => setQuery('')}
            style={styles.clearButton}
          >
            <Text style={styles.clearText}>清空</Text>
          </Pressable>
        )}
      </View>

      {query.length === 0 ? (
        <Text style={styles.hint}>输入关键词，找回过去的记录</Text>
      ) : results.length > 0 ? (
        <ScrollView contentContainerStyle={styles.results}>
          {results.map((result) => (
            <Pressable
              key={`${result.type}-${result.id}`}
              accessibilityRole="button"
              onPress={() => {
                if (result.type === 'paper') {
                  navigation.navigate('PaperDetail', { paperId: result.id })
                }
              }}
              style={styles.result}
            >
              <Text style={styles.resultTitle}>{result.title}</Text>
              <Text style={styles.resultDetail} numberOfLines={2}>
                {result.detail}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.empty}>
          <PaperEmptyIllustration />
          <Text style={styles.emptyText}>没有找到相关内容</Text>
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
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  input: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paperColors.line,
    backgroundColor: paperColors.surfaceSoft,
    paddingHorizontal: 12,
    color: paperColors.ink,
    fontSize: 14,
  },
  clearButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  clearText: { color: paperColors.muted, fontSize: 13 },
  hint: { margin: 20, color: paperColors.muted, fontSize: 13 },
  results: { padding: 16, gap: 4 },
  result: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paperColors.line,
    paddingVertical: 12,
    gap: 4,
  },
  resultTitle: { color: paperColors.action, fontSize: 12 },
  resultDetail: { color: paperColors.ink, fontSize: 14 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: paperColors.muted, fontSize: 14 },
})
