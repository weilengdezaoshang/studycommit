import { useCallback, useEffect, useRef, useState } from 'react'
import type { StudySession } from '../contracts/study-session'
import { studySessionSchema } from '../contracts/study-session'
import type { StudySessionApi } from '../clients/study-session/study-session-client'
import type { TopicQueryApi } from '../clients/topic/topic-client'
import {
  canPerformSessionAction,
  createIdempotencyKey,
  existingSessionIdFromConflict,
  isUnknownCommandOutcome,
  sessionFromConflict,
  toUiError,
  type UiError,
} from '../study-session-runtime'
import { useToast } from '../toast-react/useToast'

export type SessionCommand = 'pause' | 'resume' | 'complete'

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

export type StudySessionControllerDeps = {
  studySessions: StudySessionApi
  topics: TopicQueryApi
  subscribeForeground: (onForeground: () => void) => () => void
  enablePoll?: boolean
}

const FOCUS_REFRESH_MS = 10_000
const POLL_MS = 30_000

export function useStudySessionController({
  studySessions,
  topics,
  subscribeForeground,
  enablePoll = true,
}: StudySessionControllerDeps): StudySessionController {
  const toast = useToast()
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
    if (!next) {
      setTopicName('当前专题')
    }
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
    void reload()
  }, [reload])

  useEffect(() => {
    let lastQuery = Date.now()
    const refreshIfStale = () => {
      if (Date.now() - lastQuery < FOCUS_REFRESH_MS) {
        return
      }
      lastQuery = Date.now()
      void studySessions.getActive().then(
        (result) => applySession(result.session, result.serverNow),
        () => undefined,
      )
    }
    const disposeForeground = subscribeForeground(refreshIfStale)
    const poll = enablePoll
      ? setInterval(() => {
          lastQuery = Date.now()
          void studySessions.getActive().then(
            (result) => applySession(result.session, result.serverNow),
            () => undefined,
          )
        }, POLL_MS)
      : null
    return () => {
      disposeForeground()
      if (poll !== null) {
        clearInterval(poll)
      }
    }
  }, [applySession, enablePoll, studySessions, subscribeForeground])

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
      const idempotencyKey = pendingKeys.current[command] ?? createIdempotencyKey()
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
            const confirmUiError = toUiError(confirmError)
            setLoadError(confirmUiError)
            setPendingCommand(null)
            setConfirmingRemote(false)
            toast.show(confirmUiError.message)
          }
          return
        }
        setLoadError(uiError)
        setPendingCommand(null)
        toast.show(uiError.message)
      }
    },
    [applySession, pendingCommand, session, studySessions, toast],
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

  return {
    phase: derivePhase(hasLoaded, session, loadError),
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
  studySessions: StudySessionApi,
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
  const result = await studySessions.complete({
    sessionId: session.id,
    version: session.version,
    idempotencyKey,
    completionSource: extra?.completionSource ?? 'online',
    endedAt: extra?.endedAt,
  })
  return result.session
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
