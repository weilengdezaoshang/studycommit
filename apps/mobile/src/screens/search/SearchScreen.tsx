import { useEffect, useMemo, useRef, useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PaperEmptyIllustration } from '../../features/papers/paper-empty-illustration'
import { paperColors } from '../../features/papers/paper-visual'
import { usePapersState } from '../../features/papers/papers-store'
import { useMobileServices } from '../../core/MobileServicesProvider'

type SearchResultRow = { type: 'paper' | 'topic'; id: string; title: string; detail: string }

const DEBOUNCE_MS = 300

/** 搜索纸页与箱子:服务端统一搜索(BE-310)优先,失败回退本地过滤;入口在抽屉顶部。 */
export function SearchScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const state = usePapersState()
  const { search } = useMobileServices()
  const [query, setQuery] = useState('')
  /** 服务端搜索结果;null 表示尚未成功(含离线回退) */
  const [serverResults, setServerResults] = useState<SearchResultRow[] | null>(null)
  const [serverFailed, setServerFailed] = useState(false)
  const requestSeq = useRef(0)

  const keyword = query.trim()

  const localResults = useMemo<SearchResultRow[]>(() => {
    const lower = keyword.toLowerCase()
    if (!lower) {
      return []
    }
    const paperResults = state.papers
      .filter((paper) => !paper.deletedAt && paper.content.toLowerCase().includes(lower))
      .slice(0, 10)
      .map((paper) => ({
        type: 'paper' as const,
        id: paper.id,
        title: paper.createdAt.slice(0, 10),
        detail: paper.content,
      }))
    const topicResults = state.topics
      .filter((topic) => topic.name.toLowerCase().includes(lower))
      .slice(0, 10)
      .map((topic) => ({
        type: 'topic' as const,
        id: topic.id,
        title: topic.name,
        detail: `${state.papers.filter((paper) => paper.topicId === topic.id).length} 张纸页 · 主题`,
      }))
    return [...topicResults, ...paperResults]
  }, [keyword, state])

  useEffect(() => {
    // 空关键词不复位状态:渲染期按 keyword 派生,避免 effect 内同步 setState
    if (!keyword) {
      return
    }
    const seq = ++requestSeq.current
    const timer = setTimeout(() => {
      void search
        .query({ q: keyword })
        .then((result) => {
          if (requestSeq.current !== seq) {
            return
          }
          setServerResults([
            ...result.topics.map((topic) => ({
              type: 'topic' as const,
              id: topic.id,
              title: topic.name,
              detail: `${topic.paperCount} 张纸页 · 主题`,
            })),
            ...result.papers.items.map((paper) => ({
              type: 'paper' as const,
              id: paper.id,
              title: paper.createdAt.slice(0, 10),
              detail: paper.content,
            })),
          ])
          setServerFailed(false)
        })
        .catch(() => {
          if (requestSeq.current !== seq) {
            return
          }
          setServerResults(null)
          setServerFailed(true)
        })
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [keyword, search])

  // 服务端结果优先;失败或尚未返回时先展示本地过滤(云端之外的本地数据不丢)
  const showServer = Boolean(keyword) && serverResults !== null
  const results = useMemo<SearchResultRow[]>(() => {
    if (showServer && serverResults) {
      const seen = new Set(serverResults.map((row) => `${row.type}-${row.id}`))
      return [...serverResults, ...localResults.filter((row) => !seen.has(`${row.type}-${row.id}`))]
    }
    return localResults
  }, [showServer, serverResults, localResults])

  const openTopicFilter = (topicId: string) => {
    navigation.navigate('Home', { selectedTopicId: topicId })
  }

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

      {keyword.length === 0 ? (
        <Text style={styles.hint}>输入关键词，找回过去的记录</Text>
      ) : results.length > 0 ? (
        <ScrollView contentContainerStyle={styles.results}>
          {keyword.length > 0 && serverFailed ? (
            <Text style={styles.offlineNote}>云端搜索不可用，正在展示本机记录</Text>
          ) : null}
          {results.map((result) => (
            <Pressable
              key={`${result.type}-${result.id}`}
              accessibilityRole="button"
              onPress={() => {
                if (result.type === 'paper') {
                  navigation.navigate('PaperDetail', { paperId: result.id })
                } else {
                  openTopicFilter(result.id)
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
  offlineNote: {
    color: paperColors.mutedFaint ?? paperColors.muted,
    fontSize: 11,
    paddingVertical: 6,
  },
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
