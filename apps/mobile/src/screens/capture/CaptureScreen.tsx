import { CaptureProgress } from '../../components/notebook/CaptureProgress'
import peekingCat from '../../../assets/notebook/peeking-cat.png'
import { CapturePhoto } from '../../components/notebook/CapturePhoto'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useNavigation, useRoute, usePreventRemove, type RouteProp } from '@react-navigation/native'
import * as ImagePicker from 'expo-image-picker'
import { useCapturePage } from '@studycommit/common/capture-react'
import {
  createCaptureScenario,
  createCaptureState,
  applyCaptureUploadCheckpoint,
  prepareCaptureSave,
  runCaptureRecognition,
  type CaptureImage,
  type CaptureTaskEvent,
} from '@studycommit/common/capture-runtime'
import { spacing, typography, studyCommitMistBlueColors as c } from '@studycommit/design-tokens'
import { Screen } from '../../components/Screen'
import { RichTextEditor, type RichTextEditorHandle } from '../../components/RichTextEditor'
import {
  NotebookButton as Button,
  NotebookHeader,
  NotebookSheet,
  NotebookNotice,
} from '../../components/notebook/NotebookPrimitives'
import { CaptureImageStrip } from '../../components/notebook/CaptureImageStrip'
import { paperTypography } from '../../theme/paper-typography'
import type { RootStackParamList } from '../../navigation/navigation.types'
import { useMobileServices } from '../../core/MobileServicesProvider'
import { useAuthSession } from '../../infrastructure/auth/session-store'
import { mobileOcrPort } from '../../infrastructure/capture/mobile-ocr'
import {
  mobileCaptureDraftPort,
  mobileCaptureMediaPort,
} from '../../infrastructure/capture/capture-storage'
import { createMobileCaptureSavePort } from '../../infrastructure/capture/capture-save'
import { normalizeMimeType, sizeOfLocalFile } from '../../infrastructure/media/image-upload'
import { loadRemote, uuid } from '../../features/papers/papers-store'
import { CaptureCropEditor } from './CaptureCropEditor'
const titles = {
  preview: '图片预览',
  sort: '调整顺序',
  recognition: '识别文字',
  editor: '图片记录',
  viewer: '查看图片',
  permission: '添加图片',
  saving: '正在保存',
  detail: '记录详情',
  list: '记录本',
}
const examples = ['sample://1', 'sample://2', 'sample://3']

function SortableCaptureRow({
  item,
  index,
  count,
  onMove,
}: {
  item: CaptureImage
  index: number
  count: number
  onMove: (delta: -1 | 1) => void
}) {
  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 10,
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy < -28 && index < count - 1) {
            onMove(1)
          }
          if (gesture.dy > 28 && index > 0) {
            onMove(-1)
          }
        },
      }),
    [count, index, onMove],
  )
  return (
    <NotebookSheet>
      <View
        {...responder.panHandlers}
        accessibilityLabel={`第 ${index + 1} 张，向上或向下拖动调整顺序`}
        style={s.row}
      >
        <CapturePhoto uri={item.uri} style={s.thumb} />
        <Text style={s.text}>第 {index + 1} 张</Text>
        <Button disabled={index === 0} onPress={() => onMove(-1)}>
          上移
        </Button>
        <Button disabled={index === count - 1} onPress={() => onMove(1)}>
          下移
        </Button>
      </View>
    </NotebookSheet>
  )
}

export function CaptureScreen() {
  const navigation = useNavigation()
  const route = useRoute<RouteProp<RootStackParamList, 'Capture'>>()
  const preview = Boolean(route.params?.scenario)
  const services = useMobileServices()
  const session = useAuthSession()
  const accountId = session?.user.id ?? 'local-development'
  const { state, dispatch, summary } = useCapturePage(
    preview
      ? createCaptureScenario(route.params!.scenario!, examples)
      : createCaptureState(route.params?.mode),
  )
  const [saved, setSaved] = useState(false)
  const finishedRef = useRef(false)
  usePreventRemove(
    !preview && !saved && Boolean(state.images.length || state.content.trim()),
    ({ data }) => {
      Alert.alert('离开图片预览？', '当前内容尚未保存，离开后将丢失。', [
        { text: '继续编辑', style: 'cancel' },
        { text: '离开', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
      ])
    },
  )
  const [hydrated, setHydrated] = useState(preview)
  const [sourceOpen, setSourceOpen] = useState(false)
  const [formatting, setFormatting] = useState(false)
  const [picking, setPicking] = useState(false)
  const [cropImage, setCropImage] = useState<CaptureImage | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const savePort = useMemo(() => createMobileCaptureSavePort(services, uuid), [services])
  const editorRef = useRef<RichTextEditorHandle>(null)
  const image = state.images[state.selected]
  const page = (value: typeof state.page) => dispatch({ type: 'page', page: value })
  const unavailable = (message: string) => dispatch({ type: 'error', message })
  const removeImage = (item: CaptureImage) => {
    void mobileCaptureMediaPort.remove(item).catch(() => undefined)
    dispatch({ type: 'remove', id: item.id })
  }
  useEffect(() => {
    if (preview) {
      return
    }
    let current = true
    void mobileCaptureDraftPort
      .load(accountId)
      .then((draft) => {
        if (!current) {
          return
        }
        if (draft) {
          dispatch({ type: 'restore', state: draft })
        } else {
          setSourceOpen(true)
        }
      })
      .finally(() => {
        if (current) {
          setHydrated(true)
        }
      })
    return () => {
      current = false
      abortRef.current?.abort()
    }
  }, [accountId, dispatch, preview])

  useEffect(() => {
    if (
      saved ||
      !hydrated ||
      preview ||
      state.recovery ||
      (!state.images.length && !state.content.trim())
    ) {
      return
    }
    const timeout = setTimeout(() => {
      if (!finishedRef.current) {
        void mobileCaptureDraftPort.save(accountId, state).catch(() => undefined)
      }
    }, 500)
    return () => clearTimeout(timeout)
  }, [accountId, hydrated, preview, saved, state])
  const pick = async (camera: boolean) => {
    if (!hydrated || picking) {
      return
    }
    if (state.images.length >= 9) {
      unavailable('最多添加 9 张图片')
      return
    }
    setSourceOpen(false)
    setPicking(true)
    try {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync()
        if (!permission.granted) {
          page('permission')
          return
        }
      }
      const result = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsMultipleSelection: true,
            selectionLimit: 9 - state.images.length,
            quality: 1,
          })
      if (!result.canceled) {
        page('preview')
        const images = await Promise.all(
          result.assets.slice(0, 9 - state.images.length).map(async (asset, index) =>
            mobileCaptureMediaPort.persist(
              {
                id: `${Date.now()}-${index}`,
                uri: asset.uri,
                version: 1,
                status: 'waiting',
                text: '',
                width: asset.width,
                height: asset.height,
                mimeType: normalizeMimeType(asset.mimeType),
                sizeBytes: asset.fileSize ?? sizeOfLocalFile(asset.uri),
              },
              accountId,
            ),
          ),
        )
        dispatch({ type: 'add', images })
      }
    } catch {
      unavailable('暂时无法读取图片，请检查权限后重试')
    } finally {
      setPicking(false)
    }
  }
  const applyTaskEvent = (event: CaptureTaskEvent) => {
    if (event.type === 'working') {
      dispatch({
        type: 'result',
        id: event.id,
        version: event.version,
        runId: event.runId,
        status: 'working',
      })
    } else if (event.type === 'result') {
      dispatch({
        type: 'result',
        id: event.id,
        version: event.version,
        runId: event.runId,
        status: event.status,
        text: event.text,
      })
    } else {
      dispatch({
        type: 'result',
        id: event.id,
        version: event.version,
        runId: event.runId,
        status: 'failed',
      })
    }
  }
  const recognize = (failedOnly = false) => {
    if (preview) {
      unavailable('识别服务尚未接通，图片已保留')
      return
    }
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const candidates = failedOnly
      ? state.images.filter((item) => item.status === 'failed')
      : state.images
    const runId = uuid()
    page('recognition')
    dispatch({ type: 'run', runId, ids: candidates.map((item) => item.id) })
    void runCaptureRecognition(candidates, mobileOcrPort, runId, controller.signal, applyTaskEvent)
  }
  const cancelRecognition = () => {
    const runId = state.activeRunId
    abortRef.current?.abort()
    if (runId) {
      dispatch({ type: 'cancel-run', runId })
    }
    page('preview')
  }
  const applyCrop = async (result: { uri: string; width: number; height: number }) => {
    const current = cropImage
    if (!current) {
      return
    }
    try {
      const cropped = await mobileCaptureMediaPort.persist(
        {
          ...current,
          uri: result.uri,
          width: result.width,
          height: result.height,
          version: current.version + 1,
          sizeBytes: sizeOfLocalFile(result.uri),
          mimeType: 'image/jpeg',
        },
        accountId,
      )
      dispatch({
        type: 'crop',
        id: current.id,
        uri: cropped.uri,
        width: cropped.width ?? result.width,
        height: cropped.height ?? result.height,
        sizeBytes: cropped.sizeBytes,
        mimeType: cropped.mimeType,
      })
      await mobileCaptureMediaPort.remove(current)
      setCropImage(null)
    } catch {
      unavailable('裁剪结果保存失败，请重试')
    }
  }
  const save = async () => {
    if (preview) {
      unavailable('这是设计预览，未创建真实记录')
      return
    }
    page('saving')
    try {
      let prepared = prepareCaptureSave(state, uuid)
      dispatch({ type: 'begin-save', idempotencyKey: prepared.input.idempotencyKey })
      await mobileCaptureDraftPort.save(accountId, prepared.state)
      const result = await savePort.save(
        prepared.input,
        (completed) => dispatch({ type: 'save-progress', completed }),
        async (checkpoint) => {
          prepared = {
            ...prepared,
            state: applyCaptureUploadCheckpoint(prepared.state, checkpoint),
          }
          dispatch({
            type: 'reserve-upload',
            id: checkpoint.imageId,
            version: checkpoint.version,
            uploadId: checkpoint.uploadId,
          })
          await mobileCaptureDraftPort.save(accountId, prepared.state)
        },
      )
      finishedRef.current = true
      setSaved(true)
      await mobileCaptureDraftPort.clear(accountId)
      await loadRemote()
      requestAnimationFrame(() => navigation.navigate('PaperDetail', { paperId: result.id }))
    } catch {
      unavailable('保存未完成，已上传的图片会在本次重试中复用')
    }
  }
  const back = () => (state.page === 'preview' || preview ? navigation.goBack() : page('preview'))
  const strip = (
    <CaptureImageStrip
      images={state.images}
      selected={state.selected}
      onSelect={(index) => dispatch({ type: 'select', index })}
      onRemove={
        state.page === 'editor'
          ? (id) => {
              const item = state.images.find((candidate) => candidate.id === id)
              if (item) {
                removeImage(item)
              }
            }
          : undefined
      }
    />
  )
  return (
    <Screen style={s.screen}>
      <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <NotebookHeader
          title={state.page === 'editor' && state.mode === 'ocr' ? '识别结果' : titles[state.page]}
          onBack={back}
        />
        {preview && <Text style={s.hint}>设计预览 · 示例素材与状态</Text>}
        {state.page === 'editor' ? (
          <>
            <View style={s.row}>
              <Text style={s.text}>{state.images.length} 张图片 · 尚未保存</Text>
              <Button disabled={!summary.canSave} onPress={save}>
                保存
              </Button>
            </View>
            <NotebookSheet style={{ flex: 1 }}>
              <RichTextEditor
                editorRef={editorRef}
                initialText={state.content}
                showFormatting={formatting}
                onChange={(v) => dispatch({ type: 'content', content: v.content })}
              />
            </NotebookSheet>
            <Text style={s.text}>原图 · {state.images.length} 张</Text>
            {strip}
            <Text style={s.hint}>移除图片不会删除文字</Text>
            <View style={s.row}>
              <Button icon="image-outline" variant="secondary" onPress={() => setSourceOpen(true)}>
                添加图片
              </Button>
              <Button variant="secondary" onPress={() => setFormatting(!formatting)}>
                格式
              </Button>
              <Button
                icon="help-circle-outline"
                variant="secondary"
                onPress={() => dispatch({ type: 'question' })}
              >
                {state.question ? '取消问题标记' : '标记问题'}
              </Button>
            </View>
            {state.images.some((i) => i.missing) && (
              <NotebookNotice>原图片已失效，请移除后重新选择</NotebookNotice>
            )}
          </>
        ) : (
          <ScrollView contentContainerStyle={s.content}>
            {state.page === 'preview' && (
              <>
                <View style={s.row}>
                  <Text style={s.text}>已添加 {state.images.length} 张 · 最多 9 张</Text>
                  <Button
                    variant="secondary"
                    disabled={!state.images.length}
                    onPress={() => page('sort')}
                  >
                    排序
                  </Button>
                </View>
                <NotebookSheet>
                  {image ? (
                    <View>
                      <CapturePhoto uri={image.uri} style={s.large} />
                      <Text style={s.imageCount}>
                        {state.selected + 1} / {state.images.length}
                      </Text>
                    </View>
                  ) : (
                    <View style={s.empty}>
                      <Text style={s.heading}>把这一刻记下来</Text>
                      <Text style={s.text}>拍照或从相册选择图片</Text>
                    </View>
                  )}
                </NotebookSheet>
                <View style={s.row}>
                  <Button
                    variant="secondary"
                    icon="crop-outline"
                    disabled={!image}
                    onPress={() => image && setCropImage(image)}
                  >
                    重新裁剪
                  </Button>
                  <Button
                    variant="secondary"
                    icon="trash-outline"
                    disabled={!image}
                    onPress={() => image && removeImage(image)}
                  >
                    删除
                  </Button>
                </View>
                {strip}
                <View style={s.row}>
                  <Button
                    icon="camera-outline"
                    loading={picking}
                    disabled={state.images.length >= 9}
                    onPress={() => void pick(true)}
                  >
                    继续拍摄
                  </Button>
                  <Button
                    icon="image-outline"
                    disabled={picking || state.images.length >= 9}
                    onPress={() => void pick(false)}
                  >
                    相册添加
                  </Button>
                </View>
                <Button
                  disabled={!image}
                  onPress={() => (state.mode === 'ocr' ? recognize() : dispatch({ type: 'edit' }))}
                >
                  {state.mode === 'ocr'
                    ? `识别文字（${state.images.length} 张）`
                    : `进入编辑（${state.images.length} 张）`}
                </Button>
              </>
            )}
            {state.page === 'sort' && (
              <>
                <Text style={s.hint}>
                  上下拖动图片调整顺序，也可以点击箭头；文字和附件按此顺序排列
                </Text>
                {state.images.map((item, index) => (
                  <SortableCaptureRow
                    key={item.id}
                    item={item}
                    index={index}
                    count={state.images.length}
                    onMove={(delta) => dispatch({ type: 'move', id: item.id, delta })}
                  />
                ))}
                <Button onPress={() => page('preview')}>完成</Button>
              </>
            )}
            {state.page === 'recognition' && (
              <>
                <CaptureProgress
                  images={state.images}
                  title={summary.title}
                  onRetry={() => recognize(true)}
                />
                {!summary.working && (
                  <Button onPress={() => dispatch({ type: 'edit' })}>
                    {summary.done ? '使用已有文字' : '作为图片记录'}
                  </Button>
                )}
                <Button variant="secondary" onPress={cancelRecognition}>
                  {summary.working ? '取消识别' : '返回图片预览'}
                </Button>
              </>
            )}
            {state.page === 'saving' && (
              <>
                <NotebookSheet>
                  <Text style={s.text}>{state.content}</Text>
                  {strip}
                </NotebookSheet>
                <Text style={s.heading}>{state.error ? '保存未完成' : '正在保存'}</Text>
                <Text style={s.text}>
                  已上传 {state.saveCompleted} / {state.images.length} 张
                </Text>
                {state.images.map((item, index) => (
                  <NotebookNotice key={item.id}>
                    第 {index + 1} 张 ·{' '}
                    {index < state.saveCompleted
                      ? '已上传'
                      : item.status === 'failed'
                        ? '上传失败'
                        : item.status === 'working'
                          ? '上传中…'
                          : '等待上传'}
                  </NotebookNotice>
                ))}
                {state.error && <Button onPress={save}>重试保存</Button>}
                <Button variant="secondary" onPress={() => page('editor')}>
                  返回编辑
                </Button>
              </>
            )}
            {state.page === 'permission' && (
              <View style={s.empty}>
                <Image source={peekingCat} style={s.cat} />
                <Text style={s.heading}>还不能使用相机</Text>
                <Text style={s.text}>请在设置中开启相机权限</Text>
                <Button
                  onPress={() =>
                    void Linking.openSettings().catch(() =>
                      unavailable('请手动前往系统设置开启相机权限'),
                    )
                  }
                >
                  去设置
                </Button>
                <Button variant="secondary" onPress={() => void pick(false)}>
                  从相册选择
                </Button>
              </View>
            )}
            {state.page === 'list' && (
              <NotebookSheet>
                <Text style={s.heading}>15 · 9月 周二</Text>
                <Text style={s.hint}>11:08 · 待整理</Text>
                {strip}
                <Text style={s.text}>共 {state.images.length} 张图片</Text>
                <Button variant="secondary" onPress={() => page('detail')}>
                  打开记录
                </Button>
              </NotebookSheet>
            )}
            {state.page === 'detail' && (
              <>
                <Text style={s.hint}>图片 · {state.images.length} 张</Text>
                {state.content ? <Text style={s.text}>{state.content}</Text> : null}
                {state.images.map((item, index) => (
                  <NotebookSheet key={item.id}>
                    <CapturePhoto uri={item.uri} style={s.large} />
                    <Button
                      variant="secondary"
                      onPress={() => {
                        dispatch({ type: 'select', index })
                        page('viewer')
                      }}
                    >{`查看第 ${index + 1} 张`}</Button>
                  </NotebookSheet>
                ))}
              </>
            )}
            {state.page === 'viewer' && (
              <>
                <ScrollView
                  maximumZoomScale={4}
                  minimumZoomScale={1}
                  contentContainerStyle={s.viewer}
                >
                  {image && <CapturePhoto uri={image.uri} style={s.large} />}
                </ScrollView>
                {strip}
                <View style={s.row}>
                  <Button
                    disabled={state.selected === 0}
                    onPress={() => dispatch({ type: 'select', index: state.selected - 1 })}
                  >
                    上一张
                  </Button>
                  <Text>
                    {state.selected + 1} / {state.images.length}
                  </Text>
                  <Button
                    disabled={state.selected === state.images.length - 1}
                    onPress={() => dispatch({ type: 'select', index: state.selected + 1 })}
                  >
                    下一张
                  </Button>
                </View>
              </>
            )}
          </ScrollView>
        )}
        {state.error ? <NotebookNotice>{state.error}</NotebookNotice> : null}
        <CaptureCropEditor
          image={cropImage}
          onCancel={() => setCropImage(null)}
          onComplete={(result) => void applyCrop(result)}
          onError={() => unavailable('图片裁剪失败，请重试')}
        />
        <Modal
          visible={sourceOpen || state.recovery}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setSourceOpen(false)
            dispatch({ type: 'recover', keep: true })
          }}
        >
          <View style={[s.overlay, !state.recovery && s.sourceOverlay]}>
            <NotebookSheet>
              {state.recovery ? (
                <>
                  <Text style={s.heading}>继续上次的记录？</Text>
                  <Text style={s.text}>还有一份未完成的草稿</Text>
                  {strip}
                  <Button onPress={() => dispatch({ type: 'recover', keep: true })}>
                    继续编辑
                  </Button>
                  <Button
                    variant="secondary"
                    onPress={() => dispatch({ type: 'recover', keep: false })}
                  >
                    丢弃后新建
                  </Button>
                </>
              ) : (
                <>
                  <Text style={s.heading}>添加图片</Text>
                  <View style={s.sourceOptions}>
                    <Button icon="camera-outline" style={s.fill} onPress={() => void pick(true)}>
                      拍照
                    </Button>
                    <Button icon="image-outline" style={s.fill} onPress={() => void pick(false)}>
                      从相册选择
                    </Button>
                  </View>
                  <Button variant="secondary" onPress={() => setSourceOpen(false)}>
                    取消
                  </Button>
                </>
              )}
            </NotebookSheet>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </Screen>
  )
}
const s = StyleSheet.create({
  screen: { backgroundColor: c.canvas, paddingHorizontal: spacing.md },
  fill: { flex: 1 },
  content: { gap: spacing.md, paddingBottom: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
    paddingVertical: spacing.xs,
  },
  text: { ...typography.body, color: c.ink },
  hint: { ...typography.bodySmall, color: c.muted, paddingVertical: spacing.xs },
  heading: { ...typography.title, ...paperTypography.heading, color: c.ink },
  imageCount: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    color: c.paper,
    backgroundColor: c.scrim,
  },
  sourceOverlay: {
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  sourceOptions: { flexDirection: 'row', gap: spacing.md },
  large: { width: '100%', height: 320 },
  thumb: { width: 64, height: 64, borderRadius: 8 },
  empty: { minHeight: 300, justifyContent: 'center', gap: spacing.lg },
  cat: { width: 180, height: 120, alignSelf: 'center', resizeMode: 'contain' },
  viewer: { backgroundColor: c.ink, minHeight: 380, justifyContent: 'center' },
  overlay: { flex: 1, backgroundColor: c.scrim, justifyContent: 'center', padding: spacing.lg },
})
