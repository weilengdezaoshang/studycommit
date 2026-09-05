import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import {
  createPaperDraftReducer,
  paperCreateInputOf,
  paperDraftValidationError,
  type PaperDraft,
  type PaperDraftAction,
} from '../paper-runtime'
import type { PaperApi } from '../ports'

/**
 * 可恢复纸页草稿 Hook(SH-305):移动端与桌面端编辑器共用。
 * 平台差异通过参数注入:draftStorage(本地持久化)、subscribeAppState(前后台)。
 * 草稿锚点 paperId 兼作创建幂等键,保存失败重试不产生重复纸页。
 */

export const PAPER_DRAFT_SAVE_ERROR = '保存失败，请检查网络后重试'

export interface PaperDraftStorage {
  load(): Promise<PaperDraft | null>
  save(draft: PaperDraft | null): Promise<void>
}

export interface UseRecoverableDraftOptions {
  draftStorage: PaperDraftStorage
  papers: PaperApi
  /** 生成新草稿锚点(客户端 UUID),仅当本地无草稿时调用 */
  createDraftId: () => string
  /** 平台前后台订阅:切到后台立即落盘,不等 debounce;可不提供 */
  subscribeAppState?: (listener: (state: 'active' | 'background') => void) => () => void
  debounceMs?: number
  now?: () => number
}

export interface RecoverableDraftController {
  draft: PaperDraft | null
  /** 挂载时从本地恢复的草稿;首次加载完成前为 null */
  loading: boolean
  saving: boolean
  saveError: string | null
  /** 最近一次成功保存到本地的本地时间戳(毫秒) */
  savedAt: number | null
  dispatch: (action: PaperDraftAction) => void
  /** 校验 + 创建纸页;成功 true,失败 false(草稿保留,attempts+1) */
  save: () => Promise<boolean>
  discard: () => Promise<void>
}

const DEFAULT_DEBOUNCE_MS = 500

export function useRecoverableDraft({
  draftStorage,
  papers,
  createDraftId,
  subscribeAppState,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  now = () => Date.now(),
}: UseRecoverableDraftOptions): RecoverableDraftController {
  const [draft, dispatch] = useReducer(createPaperDraftReducer, null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const latestDraftRef = useRef<PaperDraft | null>(null)
  latestDraftRef.current = draft
  const savingRef = useRef(false)
  const loadedRef = useRef(false)

  // 挂载:恢复本地草稿;没有则建立新锚点
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const stored = await draftStorage.load()
        if (cancelled) {
          return
        }
        if (stored) {
          dispatch({ type: 'restore', draft: stored })
        } else {
          dispatch({ type: 'start', paperId: createDraftId(), now: now() })
        }
      } catch {
        // 本地读取失败不阻塞记录:按新草稿继续
        if (!cancelled) {
          dispatch({ type: 'start', paperId: createDraftId(), now: now() })
        }
      } finally {
        if (!cancelled) {
          loadedRef.current = true
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // 草稿变化:debounce 落盘;null(已保存/已丢弃)同样写入以清空旧稿
  useEffect(() => {
    if (!loadedRef.current) {
      return
    }
    const timer = setTimeout(() => {
      void draftStorage.save(draft).then(
        () => {
          if (draft) {
            setSavedAt(draft.updatedAt)
          }
        },
        () => {
          // 本地持久化失败不打断编辑;下次变更会重试写入
        },
      )
    }, debounceMs)
    return () => {
      clearTimeout(timer)
    }
  }, [draft, debounceMs])

  // 前后台:进入后台立即落盘,不等 debounce(进程被杀也不丢内容)
  useEffect(() => {
    if (!subscribeAppState) {
      return
    }
    return subscribeAppState((state) => {
      if (state === 'background' && loadedRef.current) {
        void draftStorage.save(latestDraftRef.current).catch(() => undefined)
      }
    })
  }, [subscribeAppState])

  // 卸载:仍有未落盘内容时尽力同步写入一次
  useEffect(() => {
    return () => {
      if (loadedRef.current) {
        void draftStorage.save(latestDraftRef.current).catch(() => undefined)
      }
    }
  }, [draftStorage])

  const save = useCallback(async (): Promise<boolean> => {
    const current = latestDraftRef.current
    if (!current || savingRef.current) {
      return false
    }
    const validationError = paperDraftValidationError(current)
    if (validationError) {
      setSaveError(validationError)
      return false
    }
    savingRef.current = true
    setSaving(true)
    try {
      // 幂等键 = 草稿锚点:失败重试与崩溃恢复后重发都复用同一键
      await papers.create(paperCreateInputOf(current), { idempotencyKey: current.paperId })
      dispatch({ type: 'saveSucceeded' })
      setSaveError(null)
      return true
    } catch {
      dispatch({ type: 'saveFailed', now: now() })
      setSaveError(PAPER_DRAFT_SAVE_ERROR)
      return false
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }, [papers, now])

  const discard = useCallback(async (): Promise<void> => {
    dispatch({ type: 'discard' })
    await draftStorage.save(null).catch(() => undefined)
  }, [draftStorage])

  return { draft, loading, saving, saveError, savedAt, dispatch, save, discard }
}
