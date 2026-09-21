import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import {
  createPaperDraftReducer,
  paperCreateInputOf,
  paperDraftValidationError,
  type PaperDraft,
  type PaperDraftAction,
} from '../paper-runtime'
import type { PaperApi } from '../ports'

export const PAPER_DRAFT_SAVE_ERROR = '保存失败，请检查网络后重试'
export interface PaperDraftStorage {
  load(): Promise<PaperDraft | null>
  save(draft: PaperDraft | null): Promise<void>
}
export interface UseRecoverableDraftOptions {
  draftStorage: PaperDraftStorage
  papers: Pick<PaperApi, 'create'>
  createDraftId: () => string
  subscribeAppState?: (listener: (state: 'active' | 'background') => void) => () => void
  debounceMs?: number
  now?: () => number
}
export interface RecoverableDraftController {
  draft: PaperDraft | null
  loading: boolean
  recovered: boolean
  saving: boolean
  saveError: string | null
  storageError: string | null
  loadError: string | null
  savedAt: number | null
  dispatch: (action: PaperDraftAction) => void
  save: (latestContent?: Pick<PaperDraft, 'content' | 'contentDocument'>) => Promise<boolean>
  persist: (latestContent: Pick<PaperDraft, 'content' | 'contentDocument'>) => Promise<void>
  retryLoad: () => Promise<void>
  discard: () => Promise<void>
}

/** 双端共用草稿状态机。串行落盘，避免较早的自动保存覆盖退出/成功清理。 */
export function useRecoverableDraft(
  options: UseRecoverableDraftOptions,
): RecoverableDraftController {
  const { draftStorage, subscribeAppState, debounceMs = 500 } = options
  const latestOptions = useRef(options)
  latestOptions.current = options
  const [draft, reduce] = useReducer(createPaperDraftReducer, null)
  const [loading, setLoading] = useState(true)
  const [recovered, setRecovered] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [storageError, setStorageError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [persistedDraft, setPersistedDraft] = useState<PaperDraft | null>(null)
  const current = useRef<PaperDraft | null>(null)
  const ready = useRef(false)
  const busy = useRef(false)
  const mounted = useRef(false)
  const generation = useRef(0)
  const writes = useRef<Promise<void>>(Promise.resolve())
  const reducer = useRef(createPaperDraftReducer)
  const timestamp = () => latestOptions.current.now?.() ?? Date.now()

  const dispatch = useCallback((action: PaperDraftAction) => {
    current.current = reducer.current(current.current, action)
    reduce(action)
  }, [])

  const write = useCallback(
    (value: PaperDraft | null): Promise<void> => {
      const operation = writes.current.catch(() => undefined).then(() => draftStorage.save(value))
      writes.current = operation
      return operation.then(
        () => {
          if (mounted.current && current.current === value) {
            setPersistedDraft(value)
            setStorageError(null)
          }
        },
        (error: unknown) => {
          if (mounted.current) {
            setStorageError('草稿未能保存到本机，请保持窗口打开，先复制内容备份。')
          }
          throw error
        },
      )
    },
    [draftStorage],
  )

  const retryLoad = useCallback(async () => {
    const request = ++generation.current
    ready.current = false
    setLoading(true)
    setLoadError(null)
    try {
      const stored = await draftStorage.load()
      if (!mounted.current || request !== generation.current) {
        return
      }
      if (stored) {
        dispatch({ type: 'restore', draft: stored })
        setRecovered(true)
        setPersistedDraft(stored)
      } else {
        dispatch({
          type: 'start',
          paperId: latestOptions.current.createDraftId(),
          now: timestamp(),
        })
      }
      ready.current = true
    } catch {
      if (mounted.current && request === generation.current) {
        // 读取失败不以空白覆盖旧草稿，等待用户重试。
        setLoadError('未能读取上次草稿，请重试。原草稿尚未被覆盖。')
      }
    } finally {
      if (mounted.current && request === generation.current) {
        setLoading(false)
      }
    }
  }, [draftStorage, dispatch])

  useEffect(() => {
    mounted.current = true
    void retryLoad()
    return () => {
      mounted.current = false
      generation.current += 1
    }
  }, [retryLoad])

  useEffect(() => {
    if (!ready.current || busy.current) {
      return
    }
    const timer = setTimeout(() => {
      if (ready.current && !busy.current) {
        void write(current.current).catch(() => undefined)
      }
    }, debounceMs)
    return () => clearTimeout(timer)
  }, [draft, debounceMs, write])

  useEffect(
    () =>
      subscribeAppState?.((state) => {
        if (state === 'background' && ready.current && !busy.current) {
          void write(current.current).catch(() => undefined)
        }
      }),
    [subscribeAppState, write],
  )

  useEffect(
    () => () => {
      if (ready.current && !busy.current) {
        void write(current.current).catch(() => undefined)
      }
    },
    [write],
  )

  const save = useCallback(
    async (latestContent?: Pick<PaperDraft, 'content' | 'contentDocument'>) => {
      if (!ready.current || !current.current || busy.current) {
        return false
      }
      if (latestContent) {
        dispatch({
          type: 'restore',
          draft: { ...current.current, ...latestContent, updatedAt: timestamp() },
        })
      }
      const value = current.current!
      const error = paperDraftValidationError(value)
      if (error) {
        setSaveError(error)
        return false
      }
      busy.current = true
      setSaving(true)
      setSaveError(null)
      try {
        // 重试和超时重发保持同一幂等键。
        await latestOptions.current.papers.create(paperCreateInputOf(value), {
          idempotencyKey: value.paperId,
        })
        dispatch({ type: 'saveSucceeded' })
        await write(null).catch(() => undefined)
        setRecovered(false)
        return true
      } catch {
        dispatch({ type: 'saveFailed', now: timestamp() })
        setSaveError(PAPER_DRAFT_SAVE_ERROR)
        return false
      } finally {
        busy.current = false
        if (mounted.current) {
          setSaving(false)
        }
      }
    },
    [dispatch, write],
  )

  const persist = useCallback(
    async (latestContent: Pick<PaperDraft, 'content' | 'contentDocument'>) => {
      if (!ready.current || !current.current || busy.current) {
        throw new Error('草稿尚未准备好')
      }
      dispatch({
        type: 'restore',
        draft: { ...current.current, ...latestContent, updatedAt: timestamp() },
      })
      await write(current.current)
    },
    [dispatch, write],
  )

  const discard = useCallback(async () => {
    if (busy.current) {
      return
    }
    // 清理成功前保留内存草稿，失败不让旧稿被自动写回。
    busy.current = true
    try {
      await write(null)
      dispatch({ type: 'discard' })
      setRecovered(false)
      setStorageError(null)
    } finally {
      busy.current = false
    }
  }, [dispatch, write])

  return {
    draft,
    loading,
    recovered,
    saving,
    saveError,
    storageError,
    loadError,
    savedAt: draft && current.current === persistedDraft ? draft.updatedAt : null,
    dispatch,
    save,
    persist,
    discard,
    retryLoad,
  }
}
