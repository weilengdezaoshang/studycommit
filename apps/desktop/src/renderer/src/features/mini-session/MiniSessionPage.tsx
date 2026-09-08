import { useEffect, useMemo, useState } from 'react'
import { createDesktopStudySessionGateway } from '../study-session/api/desktop-study-session-gateway'
import { useSessionClock } from '@studycommit/common/study-session-react'
import { FragmentComposer } from '../study-session/components/FragmentComposer'
import { paperColors } from '../../features/papers/paper-visual'
import { mistLightColors } from '@studycommit/design-tokens'

/**
 * 学习小窗页面(DE-313):计时 + 片段写入 + 纸页收尾;
 * "关闭"只是隐藏窗口,会话保持 running(关闭不等于完成)。
 */
export function MiniSessionPage(): React.JSX.Element {
  const gateway = useMemo(() => createDesktopStudySessionGateway(), [])
  const [snapshot, setSnapshot] = useState<{
    session: import('@studycommit/common/contracts').StudySession | null
    serverNow: string | null
    paperQuestion: string | null
  } | null>(null)
  const [missing, setMissing] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [understanding, setUnderstanding] = useState('')
  const [nextQuestion, setNextQuestion] = useState('')
  const [error, setError] = useState<string | null>(null)

  const refresh = () => {
    void gateway
      .getActive()
      .then((active) => {
        setSnapshot({
          session: active.session,
          serverNow: active.serverNow,
          paperQuestion: active.paper?.questionText ?? null,
        })
        setMissing(active.session === null)
      })
      .catch(() => setMissing(true))
  }

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, 10_000)
    return () => {
      clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const session = snapshot?.session ?? null
  const elapsed = useSessionClock(session, snapshot?.serverNow ?? null)

  const completePaper = async () => {
    if (!session || completing) {
      return
    }
    const understandingText = understanding.trim()
    if (!understandingText) {
      setError('先写下这次弄懂了什么')
      return
    }
    setCompleting(true)
    setError(null)
    try {
      const nextQuestionText = nextQuestion.trim() || undefined
      await gateway.completePaper({
        sessionId: session.id,
        version: session.version,
        understandingText,
        ...(nextQuestionText ? { nextQuestionText, nextPaperId: crypto.randomUUID() } : {}),
        idempotencyKey: crypto.randomUUID(),
      })
      // 收尾完成:小窗自动关闭
      window.close()
    } catch (completeError) {
      setError(completeError instanceof Error ? completeError.message : '收尾失败，请重试')
      setCompleting(false)
      refresh()
    }
  }

  if (missing || !session) {
    return (
      <div style={{ ...styles.page, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
        <p style={{ margin: 0, color: paperColors.muted, fontSize: 13 }}>当前没有进行中的学习</p>
        <button type="button" className="button button--secondary" onClick={() => window.close()}>
          关闭小窗
        </button>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, letterSpacing: 1, color: paperColors.muted }}>
          {session.paperId ? '纸页学习' : '学习小窗'}
        </span>
        <button
          type="button"
          aria-label="隐藏学习小窗"
          onClick={() => window.close()}
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14 }}
        >
          ✕
        </button>
      </div>
      <div style={{ fontSize: 34, fontWeight: 600, color: paperColors.ink, textAlign: 'center' }}>
        {elapsed}
      </div>
      {snapshot?.paperQuestion ? (
        <p style={{ margin: 0, fontSize: 12, color: paperColors.muted }}>
          {snapshot.paperQuestion}
        </p>
      ) : null}

      <FragmentComposer sessionId={session.id} />

      <div style={{ marginTop: 'auto', display: 'grid', gap: 8 }}>
        <textarea
          aria-label="这次弄懂了什么"
          value={understanding}
          rows={2}
          maxLength={20_000}
          placeholder="收尾：这次弄懂了什么？（必填）"
          onChange={(event) => setUnderstanding(event.target.value)}
          style={{ width: '100%', boxSizing: 'border-box' }}
        />
        <input
          aria-label="下一个问题（可选）"
          value={nextQuestion}
          maxLength={2_000}
          placeholder="下一个问题（可选，将生成新纸页）"
          onChange={(event) => setNextQuestion(event.target.value)}
          style={{ width: '100%', boxSizing: 'border-box', minHeight: 32 }}
        />
        {error ? (
          <p role="alert" style={{ margin: 0, color: mistLightColors.danger, fontSize: 12 }}>
            {error}
          </p>
        ) : null}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="button button--secondary"
            style={{ flex: 1 }}
            onClick={() => {
              const failing = session.status === 'paused' ? '继续失败，请重试' : '暂停失败，请重试'
              void (
                session.status === 'paused'
                  ? gateway.resume({
                      sessionId: session.id,
                      version: session.version,
                      idempotencyKey: crypto.randomUUID(),
                    })
                  : gateway.pause({
                      sessionId: session.id,
                      version: session.version,
                      idempotencyKey: crypto.randomUUID(),
                    })
              )
                .then(refresh)
                .catch(() => setError(failing))
            }}
          >
            {session.status === 'paused' ? '继续' : '暂停'}
          </button>
          <button
            type="button"
            className="button"
            style={{ flex: 1 }}
            disabled={completing}
            onClick={() => void completePaper()}
          >
            {completing ? '正在回写…' : '完成并回写'}
          </button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: 14,
    background: paperColors.paper,
    overflow: 'auto',
  },
} as const
