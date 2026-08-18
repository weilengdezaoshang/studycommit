import { useCallback, useEffect, useRef, useState } from 'react'
import type { StudySession } from '@studycommit/common/contracts'
import { studySessionSchema } from '@studycommit/common/contracts'
import { canPerformSessionAction } from '@studycommit/common/study-session-runtime'
import { useDesktopServices } from '../api/DesktopServicesProvider'
export type SessionCommand = 'pause' | 'resume' | 'complete'
import {
  existingSessionIdFromConflict,
  isUnknownCommandOutcome,
  sessionFromConflict,
  toUiError,
  type UiError,
} from '../state/ui-error'

export type StudyPhase = 'loading' | 'empty' | 'active' | 'completed' | 'error'

export interface StudySessionController {
  phase: StudyPhase
  session: StudySession | null
  serverNow: string | null
  topicName: string
  pendingCommand: SessionCommand | null
  confirmingRemote: boolean
  error: UiError | null
  reload: () => void
  create: (input: {
    topicId: string
    goal: string | null
    idempotencyKey: string
    topicName?: string
  }) => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  complete: (extra?: {
    endedAt?: string
    completionSource?: 'online' | 'offline_sync'
  }) => Promise<void>
}

const FOCUS_REFRESH_MS = 10_000
const POLL_MS = 30_000

export function useStudySessionController(): StudySessionController {
  const { studySessions, topics } = useDesktopServices()
  const [session, setSession] = useState<StudySession | null>(null)
  const [serverNow, setServerNow] = useState<string | null>(null)
  const [topicName, setTopicName] = useState('当前专题')
  const [loadError, setLoadError] = useState<UiError | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [pendingCommand, setPendingCommand] = useState<SessionCommand | null>(null)
  const [confirmingRemote, setConfirmingRemote] = useState(false)
  const pendingKeys = useRef<Partial<Record<SessionCommand | 'create', string>>>({})

  const applySession = useCallback((next: StudySession | null, nextServerNow: string) => {
    setSession(next)
    setServerNow(nextServerNow)
    setHasLoaded(true)
    setLoadError(null)
    setPendingCommand(null)
    setConfirmingRemote(false)
  }, [])

  const reload = useCallback(async () => {
    try {
      const result = await studySessions.getActive()
      applySession(result.session, result.serverNow)
    } catch (error) {
      const uiError = toUiError(error)
      if (uiError.code === 'CANCELLED') {
        return
      }
      setHasLoaded(true)
      setLoadError(uiError)
    }
  }, [applySession, studySessions])

  useEffect(() => {
    // 父组件挂载时拉取活动会话；后续靠命令和轮询更新
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 启动请求
    void reload()
  }, [reload])

  useEffect(() => {
    let lastQuery = Date.now()
    const onFocus = () => {
      if (Date.now() - lastQuery >= FOCUS_REFRESH_MS) {
        lastQuery = Date.now()
        void studySessions.getActive().then(
          (result) => applySession(result.session, result.serverNow),
          () => undefined,
        )
      }
    }
    window.addEventListener('focus', onFocus)
    const poll = window.setInterval(() => {
      lastQuery = Date.now()
      void studySessions.getActive().then(
        (result) => applySession(result.session, result.serverNow),
        () => undefined,
      )
    }, POLL_MS)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.clearInterval(poll)
    }
  }, [applySession, studySessions])

  useEffect(() => {
    if (!session) {
      return
    }
    const topicId = session.topicId
    let cancelled = false
    void topics.listActive().then(
      (page) => {
        if (cancelled) {
          return
        }
        const name = page.items.find((item) => item.id === topicId)?.name
        if (name) {
          setTopicName(name)
        }
      },
      () => undefined,
    )
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在会话或专题变化时重新解析名称
  }, [session?.id, session?.topicId, topics])

  const runCommand = useCallback(
    async (
      command: SessionCommand,
      extra?: { endedAt?: string; completionSource?: 'online' | 'offline_sync' },
    ) => {
      if (!session || pendingCommand) {
        return
      }
      if (!canPerformSessionAction(session.status, command)) {
        return
      }
      const idempotencyKey = pendingKeys.current[command] ?? crypto.randomUUID()
      pendingKeys.current[command] = idempotencyKey
      setPendingCommand(command)
      try {
        const next = await sendCommand(studySessions, command, session, idempotencyKey, extra)
        pendingKeys.current[command] = undefined
        applySession(next, next.updatedAt)
      } catch (error) {
        const uiError = toUiError(error)
        if (uiError.backendCode === 'SESSION_VERSION_CONFLICT') {
          const details = parseSession(sessionFromConflict(uiError))
          if (details) {
            applySession(details, details.updatedAt)
            return
          }
          const latest = await studySessions.getById(session.id)
          applySession(latest, latest.updatedAt)
          return
        }
        if (isUnknownCommandOutcome(uiError)) {
          setConfirmingRemote(true)
          try {
            const latest = await studySessions.getById(session.id)
            if (commandTookEffect(command, latest)) {
              pendingKeys.current[command] = undefined
              applySession(latest, latest.updatedAt)
              return
            }
            const retried = await sendCommand(studySessions, command, latest, idempotencyKey, extra)
            pendingKeys.current[command] = undefined
            applySession(retried, retried.updatedAt)
          } catch (confirmError) {
            setLoadError(toUiError(confirmError))
            setPendingCommand(null)
            setConfirmingRemote(false)
          }
          return
        }
        setLoadError(uiError)
        setPendingCommand(null)
      }
    },
    [applySession, pendingCommand, session, studySessions],
  )

  const create = useCallback(
    async (input: {
      topicId: string
      goal: string | null
      idempotencyKey: string
      topicName?: string
    }) => {
      try {
        const next = await studySessions.create({
          topicId: input.topicId,
          goal: input.goal,
          idempotencyKey: input.idempotencyKey,
        })
        if (input.topicName) {
          setTopicName(input.topicName)
        }
        applySession(next, next.updatedAt)
      } catch (error) {
        const uiError = toUiError(error)
        const existingId = existingSessionIdFromConflict(uiError)
        if (existingId) {
          const latest = await studySessions.getById(existingId)
          applySession(latest, latest.updatedAt)
          return
        }
        throw uiError
      }
    },
    [applySession, studySessions],
  )

  const phase = derivePhase(hasLoaded, session, loadError)

  return {
    phase,
    session,
    serverNow,
    topicName,
    pendingCommand,
    confirmingRemote,
    error: loadError,
    reload: () => {
      void reload()
    },
    create,
    pause: () => runCommand('pause'),
    resume: () => runCommand('resume'),
    complete: (extra) => runCommand('complete', extra),
  }
}

function derivePhase(
  hasLoaded: boolean,
  session: StudySession | null,
  error: UiError | null,
): StudyPhase {
  if (!hasLoaded && !session) {
    return 'loading'
  }
  if (error && !session) {
    return 'error'
  }
  if (session?.status === 'completed') {
    return 'completed'
  }
  if (session && (session.status === 'running' || session.status === 'paused')) {
    return 'active'
  }
  return 'empty'
}

async function sendCommand(
  studySessions: ReturnType<typeof useDesktopServices>['studySessions'],
  command: SessionCommand,
  session: StudySession,
  idempotencyKey: string,
  extra?: { endedAt?: string; completionSource?: 'online' | 'offline_sync' },
): Promise<StudySession> {
  if (command === 'pause') {
    return studySessions.pause({
      sessionId: session.id,
      version: session.version,
      idempotencyKey,
    })
  }
  if (command === 'resume') {
    return studySessions.resume({
      sessionId: session.id,
      version: session.version,
      idempotencyKey,
    })
  }
  return studySessions.complete({
    sessionId: session.id,
    version: session.version,
    idempotencyKey,
    completionSource: extra?.completionSource ?? 'online',
    endedAt: extra?.endedAt,
  })
}

function commandTookEffect(command: SessionCommand, latest: StudySession): boolean {
  if (command === 'pause') {
    return latest.status === 'paused' || latest.status === 'completed'
  }
  if (command === 'resume') {
    return latest.status === 'running' || latest.status === 'completed'
  }
  return latest.status === 'completed'
}

function parseSession(value: unknown): StudySession | null {
  const parsed = studySessionSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}
