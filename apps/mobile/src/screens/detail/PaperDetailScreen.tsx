import { PaperKnowledgeSection } from './PaperKnowledgeSection'
import { paperTypography } from '../../theme/paper-typography'
import { spacing, typography, mistLightColors } from '@studycommit/design-tokens'
import { RichTextReader } from '../../components/RichTextReader'
import { PaperTransition } from '../../components/PaperTransition'
import { useEffect, useMemo, useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { paperColors } from '../../features/papers/paper-visual'
import { papersActions, usePapersState } from '../../features/papers/papers-store'
import { formatDateLabelOf } from '../../features/papers/view-model'
import { Toast } from '../../components/toast/Toast'
import { useMobileServices } from '../../core/MobileServicesProvider'
import { resolveAssetUrl } from '../../features/papers/asset-url-cache'

/** 纸页详情:优先呈现日期、状态、所属箱子和正文;继续弄懂是唯一常驻动作。 */
export function PaperDetailScreen() {
  const route = useRoute<{ key: string; name: 'PaperDetail'; params: { paperId: string } }>()
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const state = usePapersState()
  const [manageOpen, setManageOpen] = useState(false)
  const [topicChoicesOpen, setTopicChoicesOpen] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'default' | 'error' } | null>(null)

  const paper = useMemo(
    () => state.papers.find((item) => item.id === route.params.paperId),
    [state.papers, route.params.paperId],
  )
  const extra = paper ? state.extras[paper.id] : undefined
  const topic = paper?.topicId ? state.topics.find((item) => item.id === paper.topicId) : undefined
  const { uploads, papers } = useMobileServices()
  const [remoteImageUrls, setRemoteImageUrls] = useState<string[]>([])
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)
  const remoteAssets = useMemo(() => paper?.assets ?? [], [paper?.assets])

  useEffect(() => {
    // 本地预览优先;无本地图且云端有资产时异步换短时地址
    if (!remoteAssets.length || extra?.photoPath) {
      return
    }
    let cancelled = false
    void Promise.all(remoteAssets.map((asset) => resolveAssetUrl(asset.id, uploads))).then(
      (urls) => {
        if (!cancelled) {
          setRemoteImageUrls(urls.filter((url): url is string => Boolean(url)))
        }
      },
    )
    return () => {
      cancelled = true
    }
  }, [extra?.photoPath, remoteAssets, uploads])

  const [loadError, setLoadError] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  useEffect(() => {
    if (!papers.get) {
      return
    }
    if (paper && paper.contentDocument !== undefined) {
      return
    }
    let active = true
    void papers
      .get(route.params.paperId)
      .then((value) => {
        if (active) {
          papersActions.receivePaper(value)
        }
      })
      .catch(() => {
        if (active) {
          setLoadError(true)
        }
      })
    return () => {
      active = false
    }
  }, [paper, papers, route.params.paperId, loadAttempt])
  if (!paper) {
    return (
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text>返回记录</Text>
        </Pressable>
        <Text>{loadError ? '记录读取失败' : '正在读取记录…'}</Text>
        {loadError && (
          <Pressable
            onPress={() => {
              setLoadError(false)
              setLoadAttempt((value) => value + 1)
            }}
          >
            <Text>重试</Text>
          </Pressable>
        )}
      </View>
    )
  }

  // 问题状态以纸页三态为准,旧演示数据缺状态时按侧车布尔兜底
  const questionStatus =
    paper.questionStatus ??
    (extra?.hasQuestion ? (extra?.isQuestionResolved ? 'resolved' : 'thinking') : 'none')
  const hasOpenQuestion = questionStatus === 'thinking'

  async function runQuestionCommand(status: 'thinking' | 'resolved') {
    let result: string | null
    try {
      result = await papersActions.updateQuestionStatus(paper!.id, status)
    } catch {
      // 服务端失败已回滚;给非阻塞提示,不打断浏览
      setToast({ message: '暂时没能更新问题状态，请稍后再试。', type: 'error' })
      return
    }
    if (result === status) {
      setToast(
        status === 'resolved'
          ? { message: '已标记为弄懂，原来的纸页仍然保留。', type: 'default' }
          : { message: '已改回还在思考。', type: 'default' },
      )
    } else if (result !== null) {
      setToast({ message: '另一台设备已更改这张纸页，已为你展示最新状态。', type: 'default' })
    } else {
      setToast({ message: '暂时没能更新问题状态，请稍后再试。', type: 'error' })
    }
  }

  return (
    <PaperTransition style={styles.page}>
      <View style={[styles.topBar, { paddingTop: insets.top }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="关闭纸页详情"
          onPress={() => navigation.goBack()}
          style={styles.sideButton}
        >
          <Ionicons name="chevron-back" size={20} color={paperColors.ink} />
        </Pressable>
        <View style={styles.brand}>
          <Ionicons name="book-outline" size={26} color={paperColors.ink} />
          <Text style={styles.title}>StudyCommit</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="整理"
          onPress={() => setManageOpen(true)}
          style={styles.sideButton}
        >
          <Text style={styles.manageText}>整理</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheet}>
          <Text accessibilityRole="header" style={styles.pageHeading}>
            记录详情
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.time}>
              {formatDateLabelOf(paper.createdAt)} · {formatTimeOf(paper.createdAt)}
            </Text>
            <Text style={styles.time}>所属主题：{topic?.name ?? '待整理'}</Text>
          </View>
          <Text style={styles.sectionHeading}>当时记下</Text>
          {paper.contentDocument ? (
            <RichTextReader key={paper.id + ':' + paper.version} document={paper.contentDocument} />
          ) : (
            <Text style={styles.content}>{paper.content}</Text>
          )}
          {paper.questionText ? (
            <View style={styles.questionBlock}>
              <Text style={styles.questionLabel}>
                {hasOpenQuestion ? '?  还在思考' : '✓  已解决'}
              </Text>
              <Text style={styles.blockText}>{paper.questionText}</Text>
            </View>
          ) : null}
          {(extra?.photoPath ? [extra.photoPath] : remoteImageUrls).map((url, index) => (
            <Pressable
              key={url}
              accessibilityRole="button"
              accessibilityLabel={`查看第 ${index + 1} 张图片`}
              onPress={() => setViewerUrl(url)}
            >
              <Image source={{ uri: url }} style={styles.photoPreview} />
            </Pressable>
          ))}
          <PaperKnowledgeSection
            key={paper.id}
            paperId={paper.id}
            understanding={paper.understandingText}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {hasOpenQuestion && (
        <View style={[styles.actions, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('Agent', { paperId: paper.id })}
            style={styles.understandButton}
          >
            <Text style={styles.understandText}>继续弄懂 →</Text>
          </Pressable>
        </View>
      )}
      <Modal
        visible={Boolean(viewerUrl)}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerUrl(null)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="关闭图片查看"
          style={styles.imageViewer}
          onPress={() => setViewerUrl(null)}
        >
          {viewerUrl ? (
            <Image source={{ uri: viewerUrl }} resizeMode="contain" style={styles.viewerImage} />
          ) : null}
        </Pressable>
      </Modal>

      {manageOpen && (
        <Pressable
          style={styles.manageScrim}
          onPress={() => {
            setManageOpen(false)
            setTopicChoicesOpen(false)
          }}
        >
          <View />
        </Pressable>
      )}
      {manageOpen && (
        <View style={[styles.manageSheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.manageHead}>
            <Text style={styles.manageTitle}>{topicChoicesOpen ? '选择箱子' : '整理纸页'}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setManageOpen(false)
                setTopicChoicesOpen(false)
              }}
            >
              <Text style={styles.manageClose}>关闭</Text>
            </Pressable>
          </View>
          {topicChoicesOpen ? (
            <ScrollView style={styles.boxChoices}>
              {state.topics.map((topic) => (
                <Pressable
                  key={topic.id}
                  accessibilityRole="button"
                  onPress={() => {
                    void papersActions
                      .organizePaper(paper.id, topic.id)
                      .then(() => {
                        setManageOpen(false)
                        setTopicChoicesOpen(false)
                      })
                      .catch(() => undefined)
                  }}
                  style={styles.boxChoice}
                >
                  <Text style={styles.boxChoiceName}>{topic.name}</Text>
                  <Text style={styles.boxChoiceCount}>
                    {
                      state.papers.filter((item) => item.topicId === topic.id && !item.deletedAt)
                        .length
                    }{' '}
                    张纸页
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <View>
              <Pressable
                accessibilityRole="button"
                onPress={() => setTopicChoicesOpen(true)}
                style={styles.manageAction}
              >
                <Text style={styles.manageActionTitle}>归入箱子</Text>
                <Text style={styles.manageActionHint}>
                  把这张纸页整理到一个学习主题中，纸页模板保持不变
                </Text>
              </Pressable>
              {questionStatus === 'thinking' && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    void runQuestionCommand('resolved').then(() => setManageOpen(false))
                  }}
                  style={styles.manageAction}
                >
                  <Text style={styles.manageActionTitle}>标记问题已解决</Text>
                  <Text style={styles.manageActionHint}>只更新问题状态，不删除或改写原记录</Text>
                </Pressable>
              )}
              {questionStatus === 'resolved' && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    void runQuestionCommand('thinking').then(() => setManageOpen(false))
                  }}
                  style={styles.manageAction}
                >
                  <Text style={styles.manageActionTitle}>重新打开问题</Text>
                  <Text style={styles.manageActionHint}>理解会改变，重新打开后可以继续弄懂</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </PaperTransition>
  )
}

function formatTimeOf(iso: string): string {
  const date = new Date(iso)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: paperColors.canvas },
  pageHeading: {
    ...paperTypography.heading,
    ...typography.title,
    color: paperColors.ink,
    alignSelf: 'flex-start',
    marginBottom: spacing.lg,
    borderBottomWidth: 4,
    borderBottomColor: paperColors.actionSurfaceStrong,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    minHeight: 44,
    backgroundColor: paperColors.canvas,
  },
  sideButton: { width: 48, height: 44, alignItems: 'center', justifyContent: 'center' },
  brand: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...paperTypography.heading,
    textAlign: 'center',
    color: paperColors.ink,
    fontSize: 20,
    fontWeight: '500',
  },
  manageText: { color: paperColors.action, fontSize: 14 },
  sheet: {
    flexGrow: 1,
    margin: 0,
    backgroundColor: paperColors.paper,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paperColors.lineStrong,
    padding: spacing.lg,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  time: { color: paperColors.muted, ...typography.caption },
  stateChip: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paperColors.line,
    backgroundColor: paperColors.surfaceWarm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  stateChipText: { color: paperColors.muted, fontSize: 10 },
  topicChip: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    backgroundColor: paperColors.actionSurface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 12,
  },
  topicChipText: { color: paperColors.action, fontSize: 11 },
  content: { color: paperColors.ink, fontSize: 16, lineHeight: 28 },
  questionBlock: {
    marginTop: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mistLightColors.warning,
    backgroundColor: mistLightColors.warningSurface,
    padding: spacing.md,
    gap: 6,
  },
  understandingBlock: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: paperColors.paper,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: paperColors.line,
    padding: spacing.md,
    gap: 6,
  },
  sectionHeading: {
    ...typography.subheading,
    color: paperColors.ink,
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
    borderBottomWidth: 3,
    borderBottomColor: paperColors.actionSurfaceStrong,
  },
  questionLabel: { ...typography.body, color: paperColors.ink, fontWeight: '600' },
  blockLabel: { color: paperColors.muted, ...typography.bodySmall },
  blockText: { color: paperColors.ink, fontSize: 14, lineHeight: 24 },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginTop: 16,
    backgroundColor: paperColors.actionSurface,
  },
  imageViewer: {
    flex: 1,
    backgroundColor: '#18202DEB',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  viewerImage: { width: '100%', height: '100%' },
  actions: { paddingHorizontal: 20, paddingTop: 12 },
  understandButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: paperColors.action,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paperColors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  understandText: { color: paperColors.paper, fontSize: 14, fontWeight: '500' },
  manageScrim: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: paperColors.scrim,
  },
  manageSheet: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    backgroundColor: paperColors.paper,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 6,
    shadowColor: paperColors.ink,
    shadowOpacity: 0.18,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  manageHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paperColors.line,
  },
  manageTitle: { color: paperColors.ink, fontSize: 14, fontWeight: '500' },
  manageClose: { color: paperColors.muted, fontSize: 13 },
  manageAction: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paperColors.line,
    gap: 4,
  },
  manageActionTitle: { color: paperColors.ink, fontSize: 14 },
  manageActionHint: { color: paperColors.muted, fontSize: 11, lineHeight: 16 },
  boxChoices: { maxHeight: 260 },
  boxChoice: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paperColors.line,
  },
  boxChoiceName: { color: paperColors.ink, fontSize: 14 },
  boxChoiceCount: { color: paperColors.muted, fontSize: 12 },
})
