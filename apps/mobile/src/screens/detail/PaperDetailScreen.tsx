import { useMemo, useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { paperColors } from '../../features/papers/paper-visual'
import { papersActions, usePapersState } from '../../features/papers/papers-store'
import { formatDateLabelOf } from '../../features/papers/view-model'
import { Toast } from '../../components/toast/Toast'

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

  if (!paper) {
    return <View style={styles.page} />
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
    <View style={styles.page}>
      <View style={[styles.topBar, { paddingTop: insets.top }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="关闭纸页详情"
          onPress={() => navigation.goBack()}
          style={styles.sideButton}
        >
          <Ionicons name="chevron-back" size={20} color={paperColors.ink} />
        </Pressable>
        <Text style={styles.title}>纸页</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="整理"
          onPress={() => setManageOpen(true)}
          style={styles.sideButton}
        >
          <Text style={styles.manageText}>整理</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.sheet}>
        <View style={styles.metaRow}>
          <Text style={styles.time}>
            {formatDateLabelOf(paper.createdAt)} · {formatTimeOf(paper.createdAt)}
          </Text>
          {questionStatus !== 'none' && (
            <View style={styles.stateChip}>
              <Text style={styles.stateChipText}>
                {questionStatus === 'resolved' ? '已解决' : '还在思考'}
              </Text>
            </View>
          )}
        </View>
        {topic && (
          <View style={styles.topicChip}>
            <Text style={styles.topicChipText}>{topic.name}</Text>
          </View>
        )}
        <Text style={styles.content}>{paper.content}</Text>
        {extra?.photoPath ? (
          <Image source={{ uri: extra.photoPath }} style={styles.photoPreview} />
        ) : null}
      </ScrollView>

      {hasOpenQuestion && (
        <View style={[styles.actions, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('Agent', { paperId: paper.id })}
            style={styles.understandButton}
          >
            <Text style={styles.understandText}>继续弄懂</Text>
          </Pressable>
        </View>
      )}

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
    </View>
  )
}

function formatTimeOf(iso: string): string {
  const date = new Date(iso)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: paperColors.canvas },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    minHeight: 44,
    backgroundColor: paperColors.canvas,
  },
  sideButton: { width: 48, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: {
    flex: 1,
    textAlign: 'center',
    color: paperColors.muted,
    fontSize: 14,
    fontWeight: '500',
  },
  manageText: { color: paperColors.action, fontSize: 14 },
  sheet: {
    flex: 1,
    margin: 12,
    marginTop: 4,
    backgroundColor: paperColors.paper,
    borderRadius: 14,
    padding: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  time: { color: paperColors.muted, fontSize: 11 },
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
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginTop: 16,
    backgroundColor: paperColors.actionSurface,
  },
  actions: { paddingHorizontal: 20, paddingTop: 12 },
  understandButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: paperColors.actionSurface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paperColors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  understandText: { color: paperColors.action, fontSize: 14, fontWeight: '500' },
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
