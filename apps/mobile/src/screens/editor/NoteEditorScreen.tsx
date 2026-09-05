import { useEffect, useMemo, useRef, useState } from 'react'
import { AppState, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { KeyboardAvoidingView, Platform } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAssetUpload, useRecoverableDraft } from '@studycommit/common/paper-react'
import type { PaperDraftStorage } from '@studycommit/common/paper-react'
import { paperColors } from '../../features/papers/paper-visual'
import { createMobileDraftStorage } from '../../features/papers/draft-storage'
import { papersActions, uuid } from '../../features/papers/papers-store'
import { useMobileServices } from '../../core/MobileServicesProvider'
import {
  pickLocalImage,
  putLocalFile,
  sha256OfLocalFile,
} from '../../infrastructure/media/image-upload'

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
  const { uploads } = useMobileServices()
  const [recoveryDismissed, setRecoveryDismissed] = useState(false)
  const [pickError, setPickError] = useState<string | null>(null)
  const draftStorage = useMemo<PaperDraftStorage>(() => createMobileDraftStorage(), [])
  const localPhotoUriRef = useRef<string | null>(null)
  const controller = useRecoverableDraft({
    draftStorage,
    papers: {
      create: (input, options) =>
        papersActions.createPaper({
          ...input,
          idempotencyKey: options?.idempotencyKey,
          photoPath: localPhotoUriRef.current ?? undefined,
        }),
    },
    createDraftId: uuid,
    subscribeAppState,
  })
  const assetUpload = useAssetUpload({
    uploads,
    putFile: putLocalFile,
    sha256: sha256OfLocalFile,
    createUploadId: uuid,
  })
  const draft = controller.draft
  const hasRecoveredContent = controller.recovered && !recoveryDismissed
  const photoUri = draft?.localPhotoUri ?? null
  const photoUploadId = draft?.assetUploadIds[0] ?? null

  // 保存时创建网关需要当前图片引用:在 effect 中同步,渲染期不读 ref
  useEffect(() => {
    localPhotoUriRef.current = photoUri
  }, [photoUri])

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

  /** 选图 → 直传 → 进草稿;取消/拒绝/超限给出轻提示,不打断正文输入。 */
  const addPhoto = async () => {
    if (assetUpload.uploading) {
      return
    }
    setPickError(null)
    const picked = await pickLocalImage()
    if (picked.status === 'denied') {
      setPickError('未获得相册权限，请在系统设置中开启')
      return
    }
    if (picked.status === 'tooLarge') {
      setPickError('图片超过 10MB，请换一张')
      return
    }
    if (picked.status !== 'picked') {
      return
    }
    // 单图语义:替换旧图前先清理旧上传会话
    if (photoUploadId) {
      void assetUpload.cancelUpload(photoUploadId)
    }
    const uploadId = await assetUpload.uploadFile({
      localUri: picked.localUri,
      kind: 'image',
      mimeType: picked.mimeType,
      sizeBytes: picked.sizeBytes,
    })
    if (!uploadId) {
      return
    }
    controller.dispatch({ type: 'attachAsset', uploadId, now: Date.now() })
    controller.dispatch({ type: 'setLocalPhotoUri', uri: picked.localUri, now: Date.now() })
  }

  const removePhoto = () => {
    if (!photoUploadId) {
      return
    }
    void assetUpload.cancelUpload(photoUploadId).then(() => {
      controller.dispatch({ type: 'detachAsset', uploadId: photoUploadId, now: Date.now() })
      controller.dispatch({ type: 'setLocalPhotoUri', uri: null, now: Date.now() })
    })
  }

  const statusHint =
    pickError ??
    assetUpload.uploadError ??
    (controller.loading
      ? ''
      : controller.saving
        ? '正在保存…'
        : controller.saveError
          ? controller.saveError
          : controller.savedAt
            ? `草稿已保存 ${formatTime(controller.savedAt)}`
            : '自动保存中')

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
        {photoUri ? (
          <View style={styles.photoRow}>
            <Image source={{ uri: photoUri }} style={styles.photoPreview} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="移除图片"
              onPress={removePhoto}
              style={styles.photoRemove}
            >
              <Ionicons name="close" size={14} color={paperColors.paper} />
            </Pressable>
          </View>
        ) : null}
      </View>

      <View style={[styles.tools, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={photoUri ? '重新选择图片' : '添加图片'}
          onPress={addPhoto}
          disabled={assetUpload.uploading}
          style={[styles.tool, photoUri && styles.toolActive]}
        >
          <Ionicons name="image-outline" size={16} color={paperColors.muted} />
          <Text style={styles.toolText}>
            {assetUpload.uploading ? '上传中…' : photoUri ? '已添加图片' : '图片'}
          </Text>
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
          style={[
            styles.hint,
            (pickError || assetUpload.uploadError || controller.saveError) && styles.hintError,
          ]}
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
  photoRow: {
    marginTop: 10,
    flexDirection: 'row',
  },
  photoPreview: {
    width: 132,
    height: 110,
    borderRadius: 10,
    backgroundColor: paperColors.actionSurface,
  },
  photoRemove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
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
