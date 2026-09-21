import { motion } from '@studycommit/design-tokens'
import {
  explanationThreshold,
  explanationHistoryThreshold,
} from '@studycommit/common/paper-runtime'
import { useRef, useState } from 'react'
import { usePaperExplanation } from '@studycommit/common/paper-react'
import type { PaperExplainOutput } from '@studycommit/rpc-contracts/ai'
import type { PaperWithExtra } from './view-model'
import { papersActions } from './papers-store'
import type { AiGateway } from '../study-session/api/desktop-study-session-gateway'

export function PaperExplainPanel({
  paper,
  ai,
  onClose,
}: {
  paper: PaperWithExtra
  ai: AiGateway
  onClose: () => void
}) {
  const flow = usePaperExplanation({
    paperId: paper.id,
    content: paper.content,
    ai,
    createIdempotencyKey: () => crypto.randomUUID(),
    onConfirmed: () => {
      papersActions.markQuestionConfirmed(paper.id)
      onClose()
    },
  })
  const card = useRef<HTMLDivElement>(null)
  const origin = useRef<{ x: number; y: number; axis: 'x' | 'y' | null } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [vertical, setVertical] = useState(0)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [height, setHeight] = useState(500)
  const upThreshold = explanationHistoryThreshold(height)
  const [offset, setOffset] = useState(0)
  const [width, setWidth] = useState(400)
  const threshold = explanationThreshold(width)
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const slide = async (direction: number) => {
    if (!card.current || reduced) {
      return
    }
    const animation = card.current.animate(
      [
        {
          transform: `translate(${offset}px, ${vertical}px) rotate(${Math.max(-3.1, Math.min(3.1, (offset / threshold) * 3))}deg)`,
        },
        { transform: `translateX(${direction * (width + 60)}px) rotate(${direction * 6}deg)` },
      ],
      { duration: motion.durationSlow, easing: 'cubic-bezier(.25,.1,.25,1)' },
    )
    try {
      await animation.finished
    } catch {
      /* 返回或减少动态可中断 */
    }
  }
  const command = async (direction: number) => {
    if (flow.busy) {
      return
    }
    setConfirming(direction > 0)
    if (direction < 0) {
      await flow.advance(() => slide(-1))
    } else {
      await flow.confirm(() => slide(1))
    }
    setOffset(0)
    setConfirming(false)
  }
  return (
    <section className="paper-explain-page" aria-label="继续弄懂">
      <header>
        <button type="button" onClick={onClose}>
          返回记录
        </button>
        <span>StudyCommit</span>
      </header>
      <details>
        <summary>原问题</summary>
        <p>{paper.questionText || paper.content}</p>
      </details>
      <div className="explanation-deck">
        {flow.next && !confirming && offset < 0 && (
          <div className="explanation-card explanation-card--next" aria-hidden="true" inert>
            <div style={{ opacity: Math.max(0, Math.min(1, (-offset / threshold - 2 / 3) * 3)) }}>
              <ExplainOutput output={flow.next} />
            </div>
          </div>
        )}
        <div
          ref={card}
          className="explanation-card"
          tabIndex={0}
          aria-label="解释卡，左方向键换说法，右方向键确认理解，上方向键回看解释"
          style={{
            touchAction: 'none',
            transition:
              dragging || reduced ? 'none' : `transform ${motion.durationFast}ms ease-out`,
            transform: reduced
              ? 'none'
              : `translate(${offset}px, ${vertical}px) rotate(${Math.max(-3.1, Math.min(3.1, (offset / threshold) * 3))}deg)`,
          }}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) {
              return
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              setHistoryOpen(true)
            }
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
              e.preventDefault()
              void command(e.key === 'ArrowLeft' ? -1 : 1)
            }
          }}
          onPointerDown={(e) => {
            if (
              flow.busy ||
              !flow.current ||
              (e.target as HTMLElement).closest('button,a,summary') ||
              ((e.target as HTMLElement).closest('.paper-explain__body') instanceof HTMLElement &&
                (() => {
                  const body = (e.target as HTMLElement).closest('.paper-explain__body')!
                  return body.scrollHeight > body.clientHeight + 1
                })())
            ) {
              return
            }
            origin.current = { x: e.clientX, y: e.clientY, axis: null }
            setDragging(true)
            setHeight(e.currentTarget.clientHeight)
            setWidth(e.currentTarget.clientWidth)
            e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            if (origin.current !== null) {
              const dx = e.clientX - origin.current.x
              const dy = e.clientY - origin.current.y
              if (!origin.current.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 12) {
                if (Math.abs(dx) > Math.abs(dy) * 1.4) {
                  origin.current.axis = 'x'
                } else if (dy < -Math.abs(dx) * 1.4) {
                  origin.current.axis = 'y'
                }
              }
              if (origin.current.axis === 'x') {
                setOffset(dx)
              }
              if (origin.current.axis === 'y') {
                setVertical(Math.min(0, dy))
              }
            }
          }}
          onPointerUp={() => {
            if (origin.current === null) {
              return
            }
            origin.current = null
            setDragging(false)
            if (-vertical >= upThreshold) {
              setHistoryOpen(true)
            }
            setVertical(0)
            if (Math.abs(offset) >= threshold) {
              void command(offset < 0 ? -1 : 1)
            } else {
              setOffset(0)
            }
          }}
          onPointerCancel={() => {
            origin.current = null
            setOffset(0)
            setVertical(0)
            setDragging(false)
          }}
          onLostPointerCapture={() => {
            origin.current = null
          }}
        >
          <div
            className="explanation-intent"
            style={{
              opacity:
                vertical < 0
                  ? Math.min(1, -vertical / upThreshold)
                  : Math.max(0, Math.min(1, (Math.abs(offset) / threshold - 1 / 6) * 1.2)),
            }}
          >
            {vertical < 0 ? '回看解释' : offset < 0 ? '不理解' : '理解了'}
          </div>
          {flow.pendingText ? (
            <div className="paper-explain__body" aria-busy={flow.preparing}>
              <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{flow.pendingText}</p>
              {flow.preparing && <span role="status">正在生成…</span>}
            </div>
          ) : flow.current ? (
            <ExplainOutput output={flow.current} />
          ) : (
            <div className="paper-explain__body">
              <p>基于这条记录生成一张解释卡,帮你确认自己是否真的理解了它。</p>
              <button
                type="button"
                className="paper-explain__generate"
                disabled={flow.busy || flow.preparing || !flow.price}
                onClick={() => void flow.generateFirst()}
              >
                {flow.price
                  ? `生成解释（消耗 ${flow.price.credits} 积分）`
                  : '生成解释（费用获取中…）'}
              </button>
            </div>
          )}
          <div className="explanation-accessible-actions">
            <button onClick={() => setHistoryOpen(true)}>回看解释</button>
            <button disabled={flow.busy || !flow.current} onClick={() => void command(-1)}>
              换个说法（新一轮消耗 {flow.price?.credits ?? '…'} 积分）
            </button>
            <button disabled={flow.busy || !flow.current} onClick={() => void command(1)}>
              理解了
            </button>
          </div>
        </div>
      </div>
      {flow.busy && <p role="status">正在处理，请稍候…</p>}
      {flow.error && (
        <p role="alert">
          {flow.error}
          <button onClick={flow.retry} disabled={flow.busy}>
            重试
          </button>
        </p>
      )}
      {historyOpen && (
        <section aria-label="回看解释">
          <button
            autoFocus
            onClick={() => {
              setHistoryOpen(false)
              card.current?.focus()
            }}
          >
            收起回看
          </button>
          {flow.history.map((item, i) => (
            <button
              key={item.runId}
              disabled={flow.busy}
              onClick={() => {
                flow.select(i)
                setHistoryOpen(false)
                card.current?.focus()
              }}
            >
              第 {i + 1} 种解释
            </button>
          ))}
        </section>
      )}
    </section>
  )
}

function ExplainOutput({ output }: { output: PaperExplainOutput }): React.JSX.Element {
  const { view } = output
  return (
    <div className="paper-explain__body">
      <strong>{titleOf(view.type)}</strong>
      {view.type === 'causal_chain' &&
        view.steps.map((step) => (
          <p key={step.title}>
            {step.title}：{step.detail}
          </p>
        ))}
      {view.type === 'contrast' &&
        view.items.map((item) => (
          <p key={item.aspect}>
            {item.aspect}：{item.a} / {item.b}
          </p>
        ))}
      {view.type === 'checklist' &&
        view.steps.map((step) => (
          <p key={step.action}>
            □ {step.action}：{step.reason}
          </p>
        ))}
      {view.type === 'definition_counterexample' && (
        <>
          <p>{view.definition}</p>
          <p>反例：{view.counterexample}</p>
        </>
      )}
      <details>
        <summary>看个例子</summary>
        <p>{output.example}</p>
      </details>
    </div>
  )
}

function titleOf(type: PaperExplainOutput['view']['type']): string {
  switch (type) {
    case 'causal_chain':
      return '因果链'
    case 'contrast':
      return '对照来看'
    case 'checklist':
      return '检查步骤'
    case 'definition_counterexample':
      return '一句话定义'
  }
}
