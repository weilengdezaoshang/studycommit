import { useMemo, useState } from 'react'
import { AppState } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRecoverableDraft } from '@studycommit/common/paper-react'
import type { PaperDraftStorage } from '@studycommit/common/paper-react'
import { paperColors } from '../../features/papers/paper-visual'
import { createMobileDraftStorage } from '../../features/papers/draft-storage'
import { papersActions, uuid } from '../../features/papers/papers-store'

/** 前后台订阅:切到后台立即把草稿落盘,进程被杀也不丢内容。 */
function subscribeAppState(listener: (state: 'active' | 'background') => void): () => void {
  const subscription = AppState.addEventListener('change', (status) => {
    listener(status === 'active' ? 'active' : 'background')
  })
  return () => {
    subscription.remove()
  }
}

/** 编辑器:只支持文本与图片;标题、主题与学习目标均非必填。 */
export function NoteEditorScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const [photoAttached, setPhotoAttached] = useState(false)
  const [recoveryDismissed, setRecoveryDismissed] = useState(false)
  const draftStorage = useMemo<PaperDraftStorage>(() => createMobileDraftStorage(), [])
  const controller = useRecoverableDraft({
    draftStorage,
    papers: {
      create: (input, options) =>
        papersActions.createPaper({ ...input, idempotencyKey: options?.idempotencyKey }),
    },
    createDraftId: uuid,
    subscribeAppState,
  })
  const draft = controller.draft
  const hasRecoveredContent = controller.recovered && !recoveryDismissed

  const save = async () => {
    const saved = await controller.save()
    if (saved) {
      navigation.goBack()
    }
  }

  const discardRecovered = () => {
    setRecoveryDismissed(true)
    void controller.discard().then(() => {
      controller.dispatch({ type: 'start', paperId: uuid(), now: Date.now() })
    })
  }

  const statusHint = controller.loading
    ? ''
    : controller.saving
      ? '正在保存…'
      : controller.saveError
        ? controller.saveError
        : controller.savedAt
          ? `草稿已保存 ${formatTime(controller.savedAt)}`
          : '自动保存中'

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.page}
    >
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={styles.topButton}
        >
          <Text style={styles.cancelText}>取消</Text>
        </Pressable>
        <Text style={styles.title}>新记录</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="记下"
          onPress={save}
          disabled={controller.saving}
          style={styles.topButton}
        >
          <Text style={[styles.saveText, controller.saving && styles.saveTextDisabled]}>记下</Text>
        </Pressable>
      </View>

      {hasRecoveredContent && !recoveryDismissed && (
        <View style={styles.recoveryBanner}>
          <Text style={styles.recoveryText} accessibilityLiveRegion="polite">
            已恢复上次未保存的内容
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="丢弃恢复的草稿"
            onPress={discardRecovered}
          >
            <Text style={styles.recoveryDiscard}>丢弃</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.sheet}>
        <View style={styles.dateRow}>
          <Text style={styles.dateText}>{formatToday()}</Text>
          <Text style={styles.dateText}>STUDYCOMMIT</Text>
        </View>
        <TextInput
          style={styles.input}
          multiline
          autoFocus
          placeholder="写点什么吧……"
          placeholderTextColor={paperColors.mutedFaint}
          value={draft?.content ?? ''}
          onChangeText={(value) =>
            controller.dispatch({ type: 'setContent', content: value, now: Date.now() })
          }
          textAlignVertical="top"
        />
        {photoAttached && <View style={styles.photoPlaceholder} />}
      </View>

      <View style={[styles.tools, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={photoAttached ? '重新选择图片' : '添加图片'}
          onPress={() => setPhotoAttached((value) => !value)}
          style={[styles.tool, photoAttached && styles.toolActive]}
        >
          <Ionicons name="image-outline" size={16} color={paperColors.muted} />
          <Text style={styles.toolText}>图片</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={draft?.hasQuestion ? '取消问题标记' : '标记为问题'}
          onPress={() =>
            controller.dispatch({
              type: 'setQuestion',
              hasQuestion: !draft?.hasQuestion,
              now: Date.now(),
            })
          }
          style={[styles.tool, draft?.hasQuestion && styles.toolActive]}
        >
          <Ionicons name="help-circle-outline" size={16} color={paperColors.muted} />
          <Text style={styles.toolText}>标记问题</Text>
        </Pressable>
        <Text
          style={[styles.hint, controller.saveError && styles.hintError]}
          accessibilityLiveRegion="polite"
        >
          {statusHint}
        </Text>
      </View>
    </KeyboardAvoidingView>
  )
}

function formatToday(): string {
  const date = new Date()
  const months = [
    'JAN',
    'FEB',
    'MAR',
    'APR',
    'MAY',
    'JUN',
    'JUL',
    'AUG',
    'SEP',
    'OCT',
    'NOV',
    'DEC',
  ]
  return `${months[date.getMonth()]} ${date.getDate()} ${date.getFullYear()}`
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: paperColors.canvas },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    minHeight: 44,
  },
  topButton: { minWidth: 56, height: 40, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: paperColors.muted, fontSize: 14 },
  title: { color: paperColors.muted, fontSize: 14, fontWeight: '500' },
  saveText: {
    color: paperColors.paper,
    backgroundColor: paperColors.action,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 18,
    overflow: 'hidden',
  },
  saveTextDisabled: { opacity: 0.6 },
  recoveryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: paperColors.actionSurface,
  },
  recoveryText: { color: paperColors.muted, fontSize: 12 },
  recoveryDiscard: { color: paperColors.action, fontSize: 12, fontWeight: '600' },
  sheet: {
    flex: 1,
    margin: 12,
    marginBottom: 16,
    backgroundColor: paperColors.paper,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    shadowColor: paperColors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paperColors.line,
    paddingBottom: 10,
  },
  dateText: { color: paperColors.muted, fontSize: 11, fontWeight: '600', letterSpacing: 1 },
  input: { flex: 1, color: paperColors.ink, fontSize: 15, lineHeight: 24, padding: 0 },
  photoPlaceholder: {
    height: 110,
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: paperColors.actionSurface,
  },
  tools: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  tool: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  toolActive: { borderColor: paperColors.line, backgroundColor: paperColors.actionSurface },
  toolText: { color: paperColors.muted, fontSize: 12 },
  hint: { marginLeft: 'auto', color: paperColors.mutedFaint, fontSize: 11 },
  hintError: { color: paperColors.action },
})
