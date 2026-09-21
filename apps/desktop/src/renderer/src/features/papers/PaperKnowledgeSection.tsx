import { useState } from 'react'
import { Link } from 'react-router'
import {
  knowledgeHistoryLabel,
  knowledgeRelationLabel,
  PAPER_KNOWLEDGE_COPY,
  usePaperKnowledge,
  useRelationCandidates,
} from '@studycommit/common/paper-react'
import type { PaperApi, SearchApi } from '@studycommit/common/ports'
import { unwrapIpcResult } from '../study-session/api/desktop-study-session-gateway'
import { routes } from '../../app/routes'
import { LengthFeedback, NotebookButton, StateNotice } from '../../components/notebook/Notebook'
import {
  PAPER_CONTENT_MAX_LENGTH,
  PAPER_QUESTION_MAX_LENGTH,
} from '@studycommit/common/paper-runtime'

const storage = {
  getItem: async (key: string) => localStorage.getItem(key),
  setItem: async (key: string, value: string) => {
    localStorage.setItem(key, value)
  },
}
const papers: Pick<PaperApi, 'knowledge' | 'updateKnowledge'> = {
  knowledge: async (id) => unwrapIpcResult(await window.studyCommit.papers.knowledge(id)),
  updateKnowledge: async (input) =>
    unwrapIpcResult(await window.studyCommit.papers.updateKnowledge(input)),
}
const search: SearchApi = {
  query: async (input) => {
    const result = unwrapIpcResult(await window.studyCommit.search.query(input))
    return { papers: result.papers, topics: [] }
  },
}
export function PaperKnowledgeSection({
  paperId,
  content,
  understanding,
}: {
  paperId: string
  content: string
  understanding?: string | null
}) {
  const knowledge = usePaperKnowledge({
    paperId,
    papers,
    storage,
    createId: () => crypto.randomUUID(),
  })
  const [mode, setMode] = useState<'understanding' | 'application' | 'link' | null>(null)
  const [query, setQuery] = useState('')
  const [target, setTarget] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [comparison, setComparison] = useState<string | null>(null)
  const [relationId, setRelationId] = useState(() => crypto.randomUUID())
  const candidates = useRelationCandidates(search, query, paperId)
  return (
    <section className="paper-knowledge" aria-label="理解应用与关联">
      {!knowledge.loading && !knowledge.error && (
        <p>
          {knowledge.data.additions.at(-1)?.content || understanding || PAPER_KNOWLEDGE_COPY.empty}
        </p>
      )}
      <div className="paper-knowledge__actions">
        {(['understanding', 'application'] as const).map((type) => (
          <NotebookButton
            key={type}
            onClick={() => setMode(mode === type ? null : type)}
            aria-expanded={mode === type}
          >
            {type === 'understanding'
              ? PAPER_KNOWLEDGE_COPY.understand
              : PAPER_KNOWLEDGE_COPY.apply}
          </NotebookButton>
        ))}
      </div>
      {(mode === 'understanding' || mode === 'application') && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void knowledge.append(mode)
          }}
        >
          <label>
            {mode === 'understanding'
              ? PAPER_KNOWLEDGE_COPY.understand
              : PAPER_KNOWLEDGE_COPY.apply}
            <textarea
              value={knowledge.drafts[mode]}
              disabled={knowledge.busy || !knowledge.draftReady}
              onChange={(e) => knowledge.edit(mode, e.target.value)}
              placeholder={PAPER_KNOWLEDGE_COPY.placeholder}
            />
          </label>
          <LengthFeedback
            label={mode === 'understanding' ? '理解' : '应用'}
            value={knowledge.drafts[mode]}
            limit={PAPER_CONTENT_MAX_LENGTH}
          />
          <button
            disabled={
              knowledge.busy ||
              !knowledge.drafts[mode].trim() ||
              knowledge.drafts[mode].trim().length > PAPER_CONTENT_MAX_LENGTH
            }
          >
            {knowledge.busy ? PAPER_KNOWLEDGE_COPY.saving : PAPER_KNOWLEDGE_COPY.save}
          </button>
        </form>
      )}
      {mode === 'link' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (target) {
              void knowledge.link(target, reason, relationId).then((ok) => {
                if (ok) {
                  setTarget(null)
                  setReason('')
                  setMode(null)
                }
              })
            }
          }}
        >
          <label>
            搜索关联记录
            <input maxLength={50} value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          {candidates.items.map((item) => (
            <label key={item.id}>
              <input
                type="radio"
                name="relation-target"
                checked={target === item.id}
                disabled={knowledge.data.relations.some((r) => r.targetId === item.id)}
                onChange={() => {
                  setTarget(item.id)
                  setComparison(item.content)
                  setRelationId(crypto.randomUUID())
                }}
              />
              {item.content}
            </label>
          ))}
          {candidates.busy && <p>正在搜索…</p>}
          {!candidates.busy &&
            !candidates.error &&
            query.trim() &&
            candidates.items.length === 0 && (
              <p role="status">没有找到可关联的记录，请换一个关键词。</p>
            )}
          {candidates.error && <p role="alert">{candidates.error}</p>}
          {(candidates.more || candidates.error) && (
            <button type="button" disabled={candidates.busy} onClick={candidates.load}>
              加载候选
            </button>
          )}
          {comparison && (
            <div className="knowledge-comparison" aria-label="并排对照记录">
              <article>
                <h4>当前记录</h4>
                <p>{content}</p>
              </article>
              <article>
                <h4>候选记录</h4>
                <p>{comparison}</p>
              </article>
            </div>
          )}
          <label>
            关联理由（选填）
            <textarea
              value={reason}
              maxLength={PAPER_QUESTION_MAX_LENGTH}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button disabled={!target || knowledge.busy}>确认关联</button>
        </form>
      )}
      {knowledge.loading && <p role="status">正在读取理解与关联…</p>}
      {knowledge.error && (
        <StateNotice>
          {knowledge.error}
          <button onClick={() => void knowledge.refresh()}>重新读取</button>
        </StateNotice>
      )}
      <>
        <details>
          <summary>
            {knowledgeHistoryLabel(
              knowledge.data.additions.length,
              knowledge.data.additionsHasMore,
            )}
          </summary>
          {knowledge.data.additions.map((item) => (
            <article key={item.id}>
              <small>
                {item.kind === 'understanding' ? '补充理解' : '实际应用'} ·{' '}
                {new Date(item.createdAt).toLocaleString()}
              </small>
              <p>{item.content}</p>
            </article>
          ))}
          {!knowledge.loading && !knowledge.error && !knowledge.data.additions.length && (
            <p>暂无理解或应用历史。</p>
          )}
        </details>
      </>
      <div className="paper-knowledge__relations-heading">
        <h4>
          {knowledgeRelationLabel(knowledge.data.relations.length, knowledge.data.relationsHasMore)}
        </h4>
        <button onClick={() => setMode(mode === 'link' ? null : 'link')}>
          + {PAPER_KNOWLEDGE_COPY.link}
        </button>
      </div>
      {knowledge.data.relations.map((relation) => (
        <article key={relation.id}>
          <Link to={routes.paper(relation.targetId)}>{relation.content}</Link>
          <p>{relation.reason || '未填写关联理由'}</p>
          <button
            disabled={knowledge.busy || !knowledge.draftReady}
            onClick={() => void knowledge.unlink(relation)}
          >
            移除关联
          </button>
        </article>
      ))}
      {!knowledge.loading && !knowledge.error && !knowledge.data.relations.length && (
        <p>暂无关联记录，可以把相关的想法连起来。</p>
      )}
      {knowledge.undo && (
        <button
          disabled={knowledge.busy || !knowledge.draftReady}
          onClick={() => void knowledge.restore()}
        >
          关联已移除 · 撤销
        </button>
      )}
    </section>
  )
}
