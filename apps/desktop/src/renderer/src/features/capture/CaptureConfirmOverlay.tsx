import { useEffect, useMemo, useState } from 'react'
import {
  findSensitiveContent,
  SENSITIVE_NOTICE,
  type SensitiveFinding,
} from '../../../../shared/sensitive-content'
import { papersActions } from '../papers/papers-store'
import { useDesktopServices } from '../study-session/api/DesktopServicesProvider'
import { closeCaptureConfirm } from './confirm-store'

const QUESTION_MAX = 2_000
const UNDERSTANDING_MAX = 20_000

/** OCR 建议句:取识别文本的首个非空行截断为问题输入预填。 */
export function suggestedQuestionOf(ocrText: string): string {
  const firstLine = ocrText
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0)
  if (!firstLine) {
    return ''
  }
  return firstLine.length > QUESTION_MAX ? firstLine.slice(0, QUESTION_MAX) : firstLine
}

/**
 * 截图问题确认页(DE-311):OCR 原文可编辑,确认文本与识别结果分离
 * (原文只进 asset.ocr_text,确认的问题进 paper.question_text)。
 * 动作:仅保存文字 / 从这里开始(创建 paper[desktop_capture] 并立即开始会话) / 取消。
 */
export function CaptureConfirmOverlay({ captureId }: { captureId: string }): React.JSX.Element {
  const { studySessions } = useDesktopServices()
  const [preview, setPreview] = useState<string | null>(null)
  const [ocrText, setOcrText] = useState('')
  const [ocrFailed, setOcrFailed] = useState(false)
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.studyCommit.capture
      .preview({ captureId })
      .then((result) => {
        if (!cancelled && result.ok) {
          setPreview(result.data)
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
          setOcrText(result.data.text)
          setQuestion(suggestedQuestionOf(result.data.text))
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
  }, [captureId])

  const findings = useMemo<SensitiveFinding[]>(
    () => findSensitiveContent(`${ocrText}\n${question}`),
    [ocrText, question],
  )
  const hasQuestion = question.trim().length > 0
  const hasText = ocrText.trim().length > 0
  const nearTextLimit = ocrText.length >= UNDERSTANDING_MAX - 2_000

  const close = () => {
    closeCaptureConfirm()
  }

  const cancelCapture = async () => {
    await window.studyCommit.capture.cancel({ captureId }).catch(() => undefined)
    close()
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
      })
      close()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败，请重试')
    } finally {
      setBusy(false)
    }
  }

  const startFromHere = async () => {
    if (busy || !hasQuestion) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      // 先直传截图(BE-308):失败不阻塞开始学习,仅降级为无截图绑定
      let screenshotUploadId: string | undefined
      try {
        const upload = await window.studyCommit.capture.upload({ captureId })
        if (upload.ok) {
          screenshotUploadId = upload.data.uploadId
        }
      } catch {
        screenshotUploadId = undefined
      }
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
    <div
      role="dialog"
      aria-modal="true"
      aria-label="截图问题确认"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(15, 18, 16, 0.55)',
      }}
    >
      <div
        style={{
          width: 'min(860px, 92vw)',
          maxHeight: '88vh',
          overflow: 'auto',
          background: 'var(--color-surface, #fff)',
          borderRadius: 16,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>截图学习 · 确认问题</h2>
          <button
            type="button"
            className="button button--secondary"
            onClick={() => void cancelCapture()}
          >
            取消并丢弃截图
          </button>
        </header>

        {preview ? (
          <img
            src={preview}
            alt="截图预览"
            style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 10, alignSelf: 'center' }}
          />
        ) : null}

        {ocrFailed ? (
          <p role="status" style={{ margin: 0, fontSize: 13, opacity: 0.75 }}>
            本地识别暂不可用，可以直接手写问题；原始截图已保留在本机。
          </p>
        ) : null}

        {findings.length > 0 ? (
          <div className="study-alert" role="alert">
            <p style={{ margin: 0 }}>
              {SENSITIVE_NOTICE}（疑似：{findings.map((finding) => finding.kind).join('、')}）
            </p>
          </div>
        ) : null}

        <div className="field">
          <label htmlFor="capture-ocr-text">识别原文（可编辑，仅保存在本机与纸页正文）</label>
          <textarea
            id="capture-ocr-text"
            className="capture-textarea"
            value={ocrText}
            rows={5}
            maxLength={UNDERSTANDING_MAX}
            disabled={busy}
            onChange={(event) => setOcrText(event.target.value)}
            placeholder="识别不到文字时，可以直接写下想记的内容"
          />
          {nearTextLimit && (
            <span className="capture-counter" role="status">
              {`${ocrText.length.toLocaleString()} / ${UNDERSTANDING_MAX.toLocaleString()}`}
            </span>
          )}
        </div>

        <div className="field">
          <label htmlFor="capture-question">
            这次要弄懂的问题（必填，从这里开始时作为新纸页的问题）
          </label>
          <textarea
            id="capture-question"
            value={question}
            rows={2}
            maxLength={QUESTION_MAX}
            disabled={busy}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="把截图里没弄懂的部分写成一个问题"
          />
        </div>

        {error ? (
          <p className="study-alert" role="alert">
            {error}
          </p>
        ) : null}

        <div className="study-form__actions">
          <button
            type="button"
            className="button button--secondary"
            disabled={busy || !hasText}
            title={hasText ? '只创建一条文字纸页,不绑定截图' : '识别原文为空时无法仅保存文字'}
            onClick={() => void saveTextOnly()}
          >
            仅保存文字
          </button>
          <button
            type="button"
            className="button"
            disabled={busy || !hasQuestion}
            title={hasQuestion ? '创建问题纸页并立即开始学习会话' : '先填写要弄懂的问题'}
            onClick={() => void startFromHere()}
          >
            {busy ? '正在处理…' : '从这里开始'}
          </button>
        </div>
      </div>
    </div>
  )
}
