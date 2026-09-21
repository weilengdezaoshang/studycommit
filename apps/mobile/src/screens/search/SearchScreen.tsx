/* eslint-disable @typescript-eslint/no-require-imports -- React Native 静态图片资源由 Metro require 解析 */
import { useEffect, useState } from 'react'
import { motion, spacing, typography } from '@studycommit/design-tokens'
import { Ionicons } from '@expo/vector-icons'
import {
  AccessibilityInfo,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSearchResults } from '@studycommit/common/search-react'
import { searchRowKey } from '@studycommit/common/search-runtime'
import { paperTypography } from '../../theme/paper-typography'
import { paperColors } from '../../features/papers/paper-visual'
import { usePapersState } from '../../features/papers/papers-store'
import { useMobileServices } from '../../core/MobileServicesProvider'

/** 搜索纸页与箱子:服务端统一搜索(BE-310)优先,失败回退本地过滤;查询逻辑复用公共 Hook。 */
export function SearchScreen() {
  const [focused, setFocused] = useState(false)
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const state = usePapersState()
  const { search } = useMobileServices()
  const {
    query,
    setQuery,
    keyword,
    rows: results,
    serverFailed,
  } = useSearchResults({
    gateway: search,
    source: state,
  })

  const openTopicFilter = (topicId: string) => {
    navigation.navigate('Home', { selectedTopicId: topicId })
  }

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.topBar, { paddingTop: insets.top + 4 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="关闭搜索"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={22} color={paperColors.ink} />
        </Pressable>
        <Text style={styles.title}>{!focused && !keyword ? 'StudyCommit' : '搜索'}</Text>
        <View style={styles.backButton} />
      </View>

      {!focused && !keyword && (
        <View style={styles.pageHeading}>
          <Text accessibilityRole="header" style={styles.headingText}>
            搜索
          </Text>
          <View style={styles.headingUnderline} />
        </View>
      )}
      <View style={styles.fieldRow}>
        <TextInput
          style={styles.input}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel="搜索记录、疑问或主题"
          placeholder="搜索记录、疑问或主题"
          placeholderTextColor={paperColors.mutedFaint}
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
        <SearchIntro focused={focused} />
      ) : results.length > 0 ? (
        <ScrollView contentContainerStyle={styles.results}>
          {keyword.length > 0 && serverFailed ? (
            <Text style={styles.offlineNote}>云端搜索不可用，正在展示本机记录</Text>
          ) : null}
          {results.map((result) => (
            <Pressable
              key={searchRowKey(result)}
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
              <View style={styles.resultCorner} pointerEvents="none" />
              <Text style={styles.resultTitle}>
                {result.type === 'paper' ? result.title : result.name}
              </Text>
              <Text style={styles.resultDetail} numberOfLines={3}>
                {result.type === 'paper' ? result.detail : `${result.count} 张纸页 · 主题`}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.empty}>
          {!focused && (
            <Image
              source={require('./assets/search-cat.png')}
              style={styles.cat}
              resizeMode="contain"
              accessible={false}
            />
          )}
          <Text style={styles.emptyText}>没有找到与「{keyword}」相关的内容</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  )
}

function SearchIntro({ focused }: { focused: boolean }) {
  const [opacity] = useState(() => new Animated.Value(1))
  useEffect(() => {
    let active = true
    const update = (reduced: boolean) => {
      if (!active) {
        return
      }
      opacity.stopAnimation()
      if (reduced) {
        opacity.setValue(focused ? 0 : 1)
      } else {
        Animated.timing(opacity, {
          toValue: focused ? 0 : 1,
          duration: motion.durationFast,
          useNativeDriver: true,
        }).start()
      }
    }
    void AccessibilityInfo.isReduceMotionEnabled()
      .then(update)
      .catch(() => update(true))
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', update)
    return () => {
      active = false
      opacity.stopAnimation()
      subscription.remove()
    }
  }, [focused, opacity])
  return (
    <Animated.View
      style={[styles.empty, { opacity }]}
      pointerEvents="none"
      accessibilityElementsHidden={focused}
      importantForAccessibility={focused ? 'no-hide-descendants' : 'auto'}
    >
      <Image
        source={require('./assets/search-cat.png')}
        style={styles.cat}
        resizeMode="contain"
        accessible={false}
      />
      <Text style={styles.introTitle}>找回曾经记下的想法</Text>
      <View style={styles.underline} />
      <Text style={styles.hint}>输入关键词，搜索记录与主题。</Text>
    </Animated.View>
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
    paddingBottom: spacing.sm,
    backgroundColor: paperColors.canvas,
  },
  backButton: { minWidth: 48, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { color: paperColors.ink, ...typography.heading, fontWeight: '500' },
  pageHeading: {
    alignSelf: 'flex-start',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  headingText: {
    color: paperColors.ink,
    ...paperTypography.drawer,
    // 搜索初始态的大标题对应设计稿的文楷展示字，尺寸仅用于本页。
    fontSize: 56,
    lineHeight: 68,
  },
  headingUnderline: {
    height: spacing.xs,
    width: 120,
    backgroundColor: paperColors.accent,
    borderRadius: spacing.xs,
    transform: [{ rotate: '-2deg' }],
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  input: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paperColors.line,
    backgroundColor: paperColors.paper,
    paddingHorizontal: 12,
    color: paperColors.ink,
    fontSize: 14,
  },
  clearButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  clearText: { color: paperColors.muted, fontSize: 13 },
  cat: { width: 160, height: 120 },
  introTitle: { color: paperColors.ink, ...typography.subheading, textAlign: 'center' },
  underline: {
    width: 200,
    height: 4,
    backgroundColor: paperColors.accent,
    borderRadius: 2,
    transform: [{ rotate: '-2deg' }],
  },
  hint: { color: paperColors.muted, ...typography.bodySmall, textAlign: 'center' },
  offlineNote: {
    color: paperColors.mutedFaint,
    fontSize: 11,
    paddingVertical: 6,
  },
  results: { padding: 16, gap: 12 },
  result: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: paperColors.paper,
    borderRadius: 14,
    borderTopRightRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paperColors.line,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 6,
    shadowColor: paperColors.ink,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  resultCorner: {
    position: 'absolute',
    top: 3,
    right: 10,
    width: 24,
    height: 6,
    borderRadius: 3,
    backgroundColor: paperColors.accent,
    transform: [{ rotate: '6deg' }],
  },
  resultTitle: { color: paperColors.muted, fontSize: 12, fontVariant: ['tabular-nums'] },
  resultDetail: { color: paperColors.ink, fontSize: 15, lineHeight: 24 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  emptyText: { color: paperColors.muted, fontSize: 14 },
})
