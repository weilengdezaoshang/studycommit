import { useEffect, useRef, useState } from 'react'
import type { PaperKnowledge, PaperKnowledgeCommand } from '@studycommit/rpc-contracts/papers'
import type { PaperApi } from '../ports'

export type KnowledgeStorage = {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
}
export function usePaperKnowledge({
  paperId,
  papers,
  storage,
  createId,
}: {
  createId: () => string
  paperId: string
  papers: Pick<PaperApi, 'knowledge' | 'updateKnowledge'>
  storage: KnowledgeStorage
}) {
  const [data, setData] = useState<PaperKnowledge>({
    additions: [],
    relations: [],
    additionsHasMore: false,
    relationsHasMore: false,
  })
  const [loading, setLoading] = useState(true)
  const [draftReady, setDraftReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState({ understanding: '', application: '' })
  const [undo, setUndo] = useState<Extract<PaperKnowledgeCommand, { kind: 'restoreLink' }> | null>(
    null,
  )
  const epoch = useRef(0)
  const readSequence = useRef(0)
  const locked = useRef(false)
  const attempt = useRef<
    Partial<Record<'understanding' | 'application', { text: string; id: string }>>
  >({})
  const writes = useRef(Promise.resolve())
  const key = `paper-knowledge-draft:${paperId}`
  const refresh = async () => {
    if (locked.current) {
      return
    }
    const sequence = ++readSequence.current
    const generation = epoch.current
    setLoading(true)
    setError(null)
    try {
      if (!papers.knowledge) {
        throw new Error('当前服务不支持详情扩展')
      }
      const next = await papers.knowledge(paperId)
      if (generation === epoch.current && sequence === readSequence.current) {
        setData(next)
      }
    } catch {
      if (generation === epoch.current) {
        setError('详情加载失败，请重试。')
      }
    } finally {
      if (generation === epoch.current) {
        setLoading(false)
      }
    }
  }
  useEffect(() => {
    epoch.current++
    locked.current = false
    attempt.current = {}
    setDraftReady(false)
    setBusy(false)
    setUndo(null)
    setData({ additions: [], relations: [], additionsHasMore: false, relationsHasMore: false })
    setDrafts({ understanding: '', application: '' })
    const generation = epoch.current
    void refresh()
    void storage
      .getItem(key)
      .then((value) => {
        if (value && generation === epoch.current) {
          const parsed = JSON.parse(value)
          for (const kind of ['understanding', 'application'] as const) {
            const saved = parsed.attempt?.[kind]
            if (saved && typeof saved.id === 'string' && typeof saved.text === 'string') {
              attempt.current[kind] = saved
            }
          }
          setDrafts({
            understanding: typeof parsed.understanding === 'string' ? parsed.understanding : '',
            application: typeof parsed.application === 'string' ? parsed.application : '',
          })
        }
      })
      .catch(() => {
        if (generation === epoch.current) {
          setError('未能恢复本机草稿，请稍后重试。')
        }
      })
      .finally(() => {
        if (generation === epoch.current) {
          setDraftReady(true)
        }
      })
    return () => {
      epoch.current++
    }
  }, [paperId, papers, storage])
  const persist = (next: typeof drafts) => {
    const serialized = JSON.stringify({ ...next, attempt: attempt.current })
    writes.current = writes.current.catch(() => {}).then(() => storage.setItem(key, serialized))
    void writes.current.catch(() => setError('本机草稿保存失败，请保留当前页面并重试。'))
  }
  const edit = (type: keyof typeof drafts, text: string) => {
    const next = { ...drafts, [type]: text }
    setDrafts(next)
    persist(next)
  }
  const mutate = async (input: PaperKnowledgeCommand) => {
    if (locked.current) {
      return false
    }
    locked.current = true
    readSequence.current++
    setBusy(true)
    setError(null)
    const generation = epoch.current
    try {
      if (!papers.updateKnowledge) {
        throw new Error('当前服务不支持详情扩展')
      }
      const next = await papers.updateKnowledge(input)
      if (generation !== epoch.current) {
        return false
      }
      setData(next)
      return true
    } catch {
      if (generation === epoch.current) {
        setError('操作未完成，输入已保留；请重试，或刷新检查其他设备的更改。')
      }
      return false
    } finally {
      if (generation === epoch.current) {
        locked.current = false
        setBusy(false)
      }
    }
  }
  const append = async (type: keyof typeof drafts) => {
    const content = drafts[type].trim()
    if (!content || content.length > 20000) {
      setError('请输入 1–20,000 字的补充内容。')
      return
    }
    if (!attempt.current[type] || attempt.current[type]?.text !== content) {
      attempt.current[type] = { text: content, id: createId() }
    }
    persist(drafts)
    try {
      await writes.current
    } catch {
      setError('本机草稿保存失败，请重试后再提交。')
      return
    }
    if (
      await mutate({
        kind: 'append',
        id: paperId,
        additionId: attempt.current[type]!.id,
        type,
        content,
      })
    ) {
      delete attempt.current[type]
      edit(type, '')
    }
  }
  return {
    data,
    loading,
    draftReady,
    busy,
    error,
    drafts,
    edit,
    append,
    refresh,
    undo,
    link: (targetId: string, reason: string, relationId: string) =>
      mutate({ kind: 'link', id: paperId, targetId, reason, relationId }),
    unlink: async (relation: PaperKnowledge['relations'][number]) => {
      if (
        await mutate({
          kind: 'unlink',
          id: paperId,
          relationId: relation.id,
          version: relation.version,
        })
      ) {
        setUndo({
          kind: 'restoreLink',
          id: paperId,
          relationId: relation.id,
          version: relation.version + 1,
        })
      }
    },
    restore: async () => {
      if (undo && (await mutate(undo))) {
        setUndo(null)
      }
    },
  }
}
