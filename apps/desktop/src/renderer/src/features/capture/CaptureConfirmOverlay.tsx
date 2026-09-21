import { useEffect, useMemo, useRef, useState } from 'react'
import {
  PAPER_CONTENT_MAX_LENGTH,
  PAPER_QUESTION_MAX_LENGTH,
} from '@studycommit/common/paper-runtime'
import { createCaptureState, type CaptureState } from '@studycommit/common/capture-runtime'
import { useCapturePage } from '@studycommit/common/capture-react'
import {
  findSensitiveContent,
  SENSITIVE_NOTICE,
  type SensitiveFinding,
} from '../../../../shared/sensitive-content'
import { papersActions } from '../papers/papers-store'
import { useDesktopServices } from '../study-session/api/DesktopServicesProvider'
import { closeCaptureConfirm } from './confirm-store'
import { Dialog } from '../../components/dialog/Dialog'
import { LengthFeedback, StateNotice, NotebookButton } from '../../components/notebook/Notebook'
import './capture-confirm.css'
import { withCaptureTimeout } from './with-capture-timeout'
import { STUDY_SESSIONS_ENABLED } from '../../../../shared/feature-flags'
import { CaptureRecordActions } from './CaptureRecordActions'
import { CaptureImageGallery } from './CaptureImageGallery'
import { SketchBorder } from '../../components/notebook/SketchBorder'

/** OCR 原文接近正文上限时的预警缓冲。 */
const TEXT_LIMIT_WARNING_BUFFER = 2_000

/** OCR 建议句:取识别文本的首个非空行截断为问题输入预填。 */
export function suggestedQuestionOf(ocrText: string): string {
  const firstLine = ocrText
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0)
  if (!firstLine) {
    return ''
  }
  return firstLine.length > PAPER_QUESTION_MAX_LENGTH
    ? firstLine.slice(0, PAPER_QUESTION_MAX_LENGTH)
    : firstLine
}

function createDesktopCaptureState(captureId: string): CaptureState {
  const state = createCaptureState('ocr')
  state.images = [
    { id: captureId, uri: '', version: 1, status: 'working', text: '', mimeType: 'image/png' },
  ]
  return state
}

/**
 * 截图问题确认页(DE-311):OCR 原文可编辑,确认文本与识别结果分离
 * (原文只进 asset.ocr_text,确认的问题进 paper.question_text)。
 * 默认仅提供保存图片记录 / 仅保存文字 / 取消，陪学入口受统一开关控制。
 */
export function CaptureConfirmOverlay({ captureId }: { captureId: string }): React.JSX.Element {
  const { studySessions } = useDesktopServices()
  const paperIdempotencyKey = useRef(crypto.randomUUID())
  const { state: captureState, dispatch } = useCapturePage(createDesktopCaptureState(captureId))
  const [ocrFailed, setOcrFailed] = useState(false)
  const [question, setQuestion] = useState('')
  const questionEditedRef = useRef(false)
  const [working, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  const busy = working || adding
  const appendGeneration = useRef(0)
  const lifetime = useRef(0)
  const appendLock = useRef(false)
  useEffect(
    () => () => {
      appendGeneration.current += 1
      lifetime.current += 1
    },
    [],
  )
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewFailures, setPreviewFailures] = useState<string[]>([])
  /** 截图上传失败后暂停“从这里开始”，等用户显式选择重试或仅文字继续。 */
  const [screenshotUploadFailed, setScreenshotUploadFailed] = useState(false)
  const [uploadFailureReason, setUploadFailureReason] = useState('')
  const ocrText = captureState.content
  const captureIds = captureState.images.map((item) => item.id)
  const resetPaperAttempt = () => {
    paperIdempotencyKey.current = crypto.randomUUID()
  }

  useEffect(() => {
    let cancelled = false
    void window.studyCommit.capture
      .preview({ captureId })
      .then((result) => {
        if (!cancelled && result.ok) {
          dispatch({ type: 'media', id: captureId, uri: result.data ?? '' })
        }
      })
      .catch(() => undefined)
    void window.studyCommit.capture
      .ocr({ captureId })
      .then((result) => {
        if (cancelled) {
          return
        }
        if (result.ok) {
          paperIdempotencyKey.current = crypto.randomUUID()
          dispatch({
            type: 'result',
            id: captureId,
            version: 1,
            status: result.data.text.trim() ? 'done' : 'empty',
            text: result.data.text,
          })
          dispatch({ type: 'edit' })
          if (STUDY_SESSIONS_ENABLED && !questionEditedRef.current) {
            setQuestion(suggestedQuestionOf(result.data.text))
          }
        } else {
          setOcrFailed(true)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOcrFailed(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [captureId, dispatch])

  const retryOcr = async () => {
    if (busy) {
      return
    }
    setBusy(true)
    try {
      const result = await window.studyCommit.capture.ocr({ captureId })
      if (!result.ok) {
        throw new Error('识别失败')
      }
      dispatch({
        type: 'result',
        id: captureId,
        version: 1,
        status: result.data.text.trim() ? 'done' : 'empty',
        text: result.data.text,
      })
      dispatch({ type: 'edit' })
      if (STUDY_SESSIONS_ENABLED && !questionEditedRef.current) {
        setQuestion(suggestedQuestionOf(result.data.text))
      }
      setOcrFailed(false)
    } catch {
      setOcrFailed(true)
    } finally {
      setBusy(false)
    }
  }

  const findings = useMemo<SensitiveFinding[]>(
    () => findSensitiveContent(`${ocrText}\n${question}`),
    [ocrText, question],
  )
  const hasQuestion = question.trim().length > 0
  const hasText = ocrText.trim().length > 0
  const nearTextLimit = ocrText.length >= PAPER_CONTENT_MAX_LENGTH - TEXT_LIMIT_WARNING_BUFFER

  const addScreenshot = async () => {
    if (busy || appendLock.current || captureState.images.length >= 9) {
      return
    }
    appendLock.current = true
    setAdding(true)
    const generation = ++appendGeneration.current
    const active = () => appendGeneration.current === generation
    setError(null)
    try {
      const request = window.studyCommit.capture.request().then((result) => {
        if (!active() && result.ok && result.data.status === 'completed') {
          void window.studyCommit.capture
            .cancel({ captureId: result.data.captureId })
            .catch(() => undefined)
        }
        return result
      })
      const captured = await withCaptureTimeout(request, 65_000, '追加截图超时，请重试。')
      if (!active()) {
        return
      }
      if (!captured.ok) {
        throw new Error(captured.error.message || '追加截图失败，请重试')
      }
      if (captured.data.status === 'permission-denied') {
        throw new Error('追加截图需要屏幕录制权限，请在系统设置中允许。')
      }
      if (captured.data.status === 'failed') {
        throw new Error(captured.data.message)
      }
      if (captured.data.status !== 'completed') {
        return
      }
      const id = captured.data.captureId
      const currentLifetime = lifetime.current
      const imageActive = () => lifetime.current === currentLifetime
      dispatch({
        type: 'add',
        images: [
          {
            id,
            uri: '',
            version: 1,
            status: 'working',
            text: '',
            mimeType: 'image/png',
          },
        ],
      })
      dispatch({ type: 'edit' })
      resetPaperAttempt()
      // 图片先进入列表；预览与 OCR 分别完成，不以 OCR 锁住整页。
      void withCaptureTimeout(
        window.studyCommit.capture.preview({ captureId: id }),
        5_000,
        '预览加载超时',
      )
        .then((result) => {
          if (!imageActive()) {
            return
          }
          if (!result.ok || !result.data) {
            throw new Error('预览加载失败')
          }
          dispatch({ type: 'media', id, uri: result.data })
        })
        .catch(() => {
          if (imageActive()) {
            setPreviewFailures((ids) => [...ids, id])
            setError('截图已加入，但预览加载失败。可以删除后重新截图。')
          }
        })
      void withCaptureTimeout(window.studyCommit.capture.ocr({ captureId: id }), 20_000, '识别超时')
        .then((result) => {
          if (!imageActive()) {
            return
          }
          if (!result.ok) {
            throw new Error('识别失败')
          }
          dispatch({
            type: 'result',
            id,
            version: 1,
            status: result.data.text.trim() ? 'done' : 'empty',
            text: result.data.text,
          })
          dispatch({ type: 'edit' })
          resetPaperAttempt()
        })
        .catch(() => {
          if (imageActive()) {
            dispatch({ type: 'result', id, version: 1, status: 'failed' })
            setError('追加截图文字识别失败或超时，图片已保留，可直接保存图片或手写文字。')
          }
        })
    } catch (captureError) {
      if (!active()) {
        return
      }
      appendGeneration.current += 1
      setError(captureError instanceof Error ? captureError.message : '追加截图失败，请重试')
    } finally {
      appendLock.current = false
      setAdding(false)
    }
  }

  const removeScreenshot = async (id: string) => {
    if (busy || captureState.images.length <= 1) {
      return
    }
    resetPaperAttempt()
    dispatch({ type: 'remove', id })
    await window.studyCommit.capture.cancel({ captureId: id }).catch(() => undefined)
  }

  const savePictureRecord = async () => {
    if (busy) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      const uploadIds: string[] = []
      for (const id of captureIds) {
        const upload = await window.studyCommit.capture.upload({ captureId: id })
        if (!upload.ok) {
          throw new Error(upload.error.message)
        }
        uploadIds.push(upload.data.uploadId)
      }
      await papersActions.createPaper({
        content: ocrText.trim(),
        questionText: hasQuestion ? question.trim() : undefined,
        assetUploadIds: uploadIds,
        idempotencyKey: paperIdempotencyKey.current,
      })
      await Promise.all(
        captureIds.map((id) =>
          window.studyCommit.capture.cancel({ captureId: id }).catch(() => undefined),
        ),
      )
      close()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存图片记录失败，请重试')
    } finally {
      setBusy(false)
    }
  }

  const close = () => {
    lifetime.current += 1
    appendGeneration.current += 1
    closeCaptureConfirm()
  }

  const cancelCapture = async () => {
    if (working) {
      return
    }
    setBusy(true)
    appendGeneration.current += 1
    close()
    await Promise.all(
      captureIds.map((id) =>
        window.studyCommit.capture.cancel({ captureId: id }).catch(() => undefined),
      ),
    )
  }

  const saveTextOnly = async () => {
    if (busy || !hasText) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      await papersActions.createPaper({
        content: ocrText.trim(),
        questionText: hasQuestion ? question.trim() : undefined,
        idempotencyKey: paperIdempotencyKey.current,
      })
      await Promise.all(
        captureIds.map((id) =>
          window.studyCommit.capture.cancel({ captureId: id }).catch(() => undefined),
        ),
      )
      close()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败，请重试')
    } finally {
      setBusy(false)
    }
  }

  const startFromHere = async (options?: { ignoreUploadFailure?: boolean }) => {
    if (!STUDY_SESSIONS_ENABLED) {
      return
    }
    if (busy || !hasQuestion) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      // 直传截图(BE-308):失败不再静默降级,显式请用户选择重试或仅文字继续
      let screenshotUploadId: string | undefined
      let uploadFailed = false
      if (!options?.ignoreUploadFailure) {
        try {
          const primaryCaptureId = captureState.images[0]?.id
          const upload = primaryCaptureId
            ? await withCaptureTimeout(
                window.studyCommit.capture.upload({ captureId: primaryCaptureId }),
                30_000,
                '截图上传超时，请检查网络和对象存储服务后重试。',
              )
            : null
          if (upload?.ok) {
            screenshotUploadId = upload.data.uploadId
          } else {
            uploadFailed = true
            setUploadFailureReason(
              upload && !upload.ok ? upload.error.message : '未找到要上传的截图，请重新截图。',
            )
          }
        } catch (reason) {
          uploadFailed = true
          setUploadFailureReason(
            reason instanceof Error ? reason.message : '上传服务未响应，请检查网络后重试。',
          )
        }
      }
      if (uploadFailed && !options?.ignoreUploadFailure) {
        setScreenshotUploadFailed(true)
        return
      }
      setScreenshotUploadFailed(false)
      await studySessions.create({
        draftPaper: {
          paperId: crypto.randomUUID(),
          questionText: question.trim(),
          ocrText: hasText ? ocrText.trim() : undefined,
          screenshotUploadId,
        },
        idempotencyKey: crypto.randomUUID(),
      })
      close()
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : '开始学习失败，请重试')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Dialog
        open
        title="确认截图记录"
        className="capture-confirm-dialog"
        busy={working}
        onClose={() => setConfirmDiscard(true)}
      >
        <div className="capture-confirm-content">
          <SketchBorder />
          <button
            className="capture-confirm-close"
            type="button"
            aria-label="取消并丢弃截图"
            disabled={working}
            onClick={() => setConfirmDiscard(true)}
          >
            ×
          </button>
          <p className="capture-confirm-intro">核对文字，留下这次想记的内容。</p>
          <div className="capture-confirm-workspace">
            <CaptureImageGallery
              images={captureState.images}
              busy={busy}
              adding={adding}
              previewFailures={previewFailures}
              onAdd={() => void addScreenshot()}
              onMove={(id, delta) => {
                resetPaperAttempt()
                dispatch({ type: 'move', id, delta })
              }}
              onRemove={(id) => void removeScreenshot(id)}
            />
            <div className="capture-confirm-editor">
              <div className="capture-section-label">
                <label htmlFor="capture-ocr-text">正文</label>
                <span>识别后可直接编辑</span>
              </div>
              <div className="capture-writing-paper">
                <SketchBorder />
                <textarea
                  id="capture-ocr-text"
                  aria-label="识别原文"
                  className="capture-confirm-body"
                  value={ocrText}
                  rows={10}
                  maxLength={PAPER_CONTENT_MAX_LENGTH}
                  disabled={busy}
                  onChange={(event) => {
                    resetPaperAttempt()
                    dispatch({ type: 'content', content: event.target.value })
                  }}
                  placeholder="识别出的文字会出现在这里，也可以直接输入。"
                />
              </div>
              {nearTextLimit && (
                <LengthFeedback label="正文" value={ocrText} limit={PAPER_CONTENT_MAX_LENGTH} />
              )}
              <details
                className="capture-question-section"
                open={STUDY_SESSIONS_ENABLED || undefined}
              >
                <summary>
                  补充一个疑问 <span>选填</span>
                </summary>
                <label className="visually-hidden" htmlFor="capture-question">
                  这次要弄懂的问题
                </label>
                <textarea
                  id="capture-question"
                  value={question}
                  rows={2}
                  maxLength={PAPER_QUESTION_MAX_LENGTH}
                  disabled={busy}
                  onChange={(event) => {
                    questionEditedRef.current = true
                    resetPaperAttempt()
                    setQuestion(event.target.value)
                  }}
                  placeholder="哪里还没弄明白？"
                />
                {question.length >= PAPER_QUESTION_MAX_LENGTH - 200 && (
                  <LengthFeedback label="疑问" value={question} limit={PAPER_QUESTION_MAX_LENGTH} />
                )}
              </details>
            </div>
          </div>

          {captureState.images.length >= 9 && (
            <StateNotice tone="warning">最多添加 9 张图片，请先移除再添加。</StateNotice>
          )}
          {ocrFailed ? (
            <StateNotice
              actions={
                <NotebookButton disabled={busy} onClick={() => void retryOcr()}>
                  重试识别
                </NotebookButton>
              }
            >
              文字识别失败，图片仍可保存。可以直接手写问题。
            </StateNotice>
          ) : null}

          {findings.length > 0 ? (
            <div className="study-alert" role="alert">
              <p style={{ margin: 0 }}>
                {SENSITIVE_NOTICE}（疑似：{findings.map((finding) => finding.kind).join('、')}）
              </p>
            </div>
          ) : null}

          {error ? (
            <p className="study-alert" role="alert">
              {error}
            </p>
          ) : null}

          {STUDY_SESSIONS_ENABLED && screenshotUploadFailed ? (
            <div className="study-alert" role="alert">
              <p style={{ margin: 0 }}>截图没有保存成功，不会随本次学习上传；文字内容不受影响。</p>
              {uploadFailureReason && <p>原因：{uploadFailureReason}</p>}
              <div className="study-form__actions">
                <button
                  type="button"
                  className="button"
                  disabled={busy}
                  onClick={() => void startFromHere()}
                >
                  重试上传并开始
                </button>
                <button
                  type="button"
                  className="button button--secondary"
                  disabled={busy}
                  onClick={() => void startFromHere({ ignoreUploadFailure: true })}
                >
                  不保存截图，直接开始
                </button>
              </div>
            </div>
          ) : null}

          <CaptureRecordActions
            count={captureState.images.length}
            busy={busy}
            saving={working}
            hasText={hasText}
            onSaveImages={() => void savePictureRecord()}
            onSaveText={() => void saveTextOnly()}
          >
            {STUDY_SESSIONS_ENABLED && (
              <button
                type="button"
                className="button"
                disabled={busy || !hasQuestion}
                title={hasQuestion ? '创建问题纸页并立即开始学习会话' : '先填写要弄懂的问题'}
                onClick={() => void startFromHere()}
              >
                {busy ? '正在处理…' : '从这里开始'}
              </button>
            )}
          </CaptureRecordActions>
        </div>
      </Dialog>
      <Dialog
        open={confirmDiscard}
        title="放弃这次截图？"
        busy={working}
        onClose={() => setConfirmDiscard(false)}
      >
        <p>截图和当前编辑内容尚未保存，放弃后无法恢复。</p>
        <div className="notebook-actions">
          <NotebookButton disabled={working} onClick={() => setConfirmDiscard(false)}>
            继续编辑
          </NotebookButton>
          <NotebookButton variant="danger" disabled={working} onClick={() => void cancelCapture()}>
            放弃并关闭
          </NotebookButton>
        </div>
      </Dialog>
    </>
  )
}
