import { useState } from 'react'
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
}): React.JSX.Element {
  const [output, setOutput] = useState<PaperExplainOutput | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [round, setRound] = useState(1)

  async function explain(nextDirective: 'initial' | 'alternative' = 'initial') {
    setLoading(true)
    setError(null)
    try {
      const nextRound = nextDirective === 'initial' ? 1 : Math.min(3, round + 1)
      setOutput(
        await ai.explainPaper({
          paperId: paper.id,
          content: paper.content,
          round: nextRound,
          directive: nextDirective,
          previousViewType: nextDirective === 'alternative' ? output?.view.type : undefined,
        }),
      )
      setRound(nextRound)
    } catch {
      setError('暂时拿不到解释，请稍后重试。')
    } finally {
      setLoading(false)
    }
  }

  async function confirm() {
    if (!output) {
      return
    }
    setLoading(true)
    try {
      await ai.confirmPaperExplain({ runId: output.runId })
      // 服务端确认事务内已把还在思考的问题落定为已解决,这里同步本地视图即可
      papersActions.markQuestionConfirmed(paper.id)
      onClose()
    } catch {
      setError('确认失败，纸页仍保留在“还在思考”。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="paper-explain" aria-label="继续弄懂">
      <div className="paper-explain__header">
        <h3>继续弄懂</h3>
        <button type="button" onClick={onClose} disabled={loading}>
          关闭
        </button>
      </div>
      {!output && (
        <button
          type="button"
          className="collection-primary"
          onClick={() => void explain()}
          disabled={loading}
        >
          {loading ? '正在生成解释…' : '生成解释卡'}
        </button>
      )}
      {output && <ExplainOutput output={output} />}
      {output && (
        <div className="paper-explain__actions">
          <button
            type="button"
            className="collection-primary"
            onClick={() => void confirm()}
            disabled={loading}
          >
            我已经弄懂了
          </button>
          <button type="button" onClick={() => void explain('alternative')} disabled={loading}>
            换一种说法
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="collection-action-note">
          {error}
        </p>
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
      <p>例子：{output.example}</p>
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
