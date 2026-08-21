import { useCallback, useEffect, useRef, useState } from 'react'
import type { LearningLog } from '../contracts/learning-log'
import { learningLogSchema } from '../contracts/learning-log'
import type { StudySession } from '../contracts/study-session'
import { studySessionSchema } from '../contracts/study-session'
import type { LearningLogApi } from '../clients/learning-log/learning-log-client'
import type { StudySessionApi } from '../clients/study-session/study-session-client'
import type { TopicQueryApi } from '../clients/topic/topic-client'
import {
  canPerformSessionAction,
  createIdempotencyKey,
  existingSessionIdFromConflict,
  isUnknownCommandOutcome,
  learningLogFromConflict,
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
    gains?: string | null
    problems?: string | null
    nextStep?: string | null
  }) => Promise<void>
  learningLog: LearningLog | null
  savingLog: boolean
  updateLearningLog: (input: {
    gains?: string | null
    problems?: string | null
    nextStep?: string | null
  }) => Promise<void>
}

export type StudySessionControllerDeps = {
  studySessions: StudySessionApi
  topics: TopicQueryApi
  learningLogs: LearningLogApi
  subscribeForeground: (onForeground: () => void) => () => void
  enablePoll?: boolean
}

type CommandExtra = {
  endedAt?: string
  completionSource?: 'online' | 'offline_sync'
  gains?: string | null
  problems?: string | null
  nextStep?: string | null
}

const FOCUS_REFRESH_MS = 10_000
const POLL_MS = 30_000

export function useStudySessionController({
  studySessions,
  topics,
  learningLogs,
  subscribeForeground,
  enablePoll = true,
}: StudySessionControllerDeps): StudySessionController {
  const toast = useToast()
  const [session, setSession] = useState<StudySession | null>(null)
  const [serverNow, setServerNow] = useState<string | null>(null)
  const [topicName, setTopicName] = useState('当前专题')
  const [learningLog, setLearningLog] = useState<LearningLog | null>(null)
  const [savingLog, setSavingLog] = useState(false)
  const [loadError, setLoadError] = useState<UiError | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [pendingCommand, setPendingCommand] = useState<SessionCommand | null>(null)
  const pendingKeys = useRef<Partial<Record<SessionCommand | 'create', string>>>({})

  const applySession = useCallback((next: StudySession | null, nextServerNow: string) => {
    setSession(next)
    setServerNow(nextServerNow)
    setHasLoaded(true)
    setLoadError(null)
    setPendingCommand(null)
    if (!next || next.status !== 'completed') {
      setLearningLog(null)
    }
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

  const applyCommandResult = useCallback(
    (result: { session: StudySession; learningLog?: LearningLog }) => {
      applySession(result.session, result.session.updatedAt)
      if (result.learningLog) {
        setLearningLog(result.learningLog)
      }
    },
    [applySession],
  )

  const applyConflictSession = useCallback(
    async (error: UiError, sessionId: string) => {
      const details = parseSession(sessionFromConflict(error))
      if (details) {
        applySession(details, details.updatedAt)
        return
      }
      const latest = await studySessions.getById(sessionId)
      applySession(latest, latest.updatedAt)
    },
    [applySession, studySessions],
  )

  const runCommand = useCallback(
    async (command: SessionCommand, extra?: CommandExtra) => {
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
        const result = await sendCommand(studySessions, command, session, idempotencyKey, extra)
        pendingKeys.current[command] = undefined
        applyCommandResult(result)
      } catch (error) {
        const uiError = toUiError(error)
        if (uiError.backendCode === 'SESSION_VERSION_CONFLICT') {
          pendingKeys.current[command] = undefined
          await applyConflictSession(uiError, session.id)
          return
        }
        if (isUnknownCommandOutcome(uiError)) {
          try {
            const retried = await sendCommand(
              studySessions,
              command,
              session,
              idempotencyKey,
              extra,
            )
            pendingKeys.current[command] = undefined
            applyCommandResult(retried)
          } catch (retryError) {
            const retryUiError = toUiError(retryError)
            if (retryUiError.backendCode === 'SESSION_VERSION_CONFLICT') {
              pendingKeys.current[command] = undefined
              await applyConflictSession(retryUiError, session.id)
              return
            }
            pendingKeys.current[command] = undefined
            setPendingCommand(null)
            toast.show(retryUiError.message)
          }
          return
        }
        pendingKeys.current[command] = undefined
        setPendingCommand(null)
        toast.show(uiError.message)
      }
    },
    [applyCommandResult, applyConflictSession, pendingCommand, session, studySessions, toast],
  )

  const updateLearningLog = useCallback(
    async (input: {
      gains?: string | null
      problems?: string | null
      nextStep?: string | null
    }) => {
      if (!learningLog || savingLog) {
        return
      }
      setSavingLog(true)
      try {
        const next = await learningLogs.update({
          id: learningLog.id,
          version: learningLog.version,
          ...input,
        })
        setLearningLog(next)
      } catch (error) {
        const uiError = toUiError(error)
        const conflict = parseLearningLog(learningLogFromConflict(uiError))
        if (conflict) {
          setLearningLog(conflict)
        }
        toast.show(uiError.message)
      } finally {
        setSavingLog(false)
      }
    },
    [learningLog, learningLogs, savingLog, toast],
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
    error: loadError,
    reload: () => {
      void reload()
    },
    create,
    pause: () => runCommand('pause'),
    resume: () => runCommand('resume'),
    complete: (extra) => runCommand('complete', extra),
    learningLog,
    savingLog,
    updateLearningLog,
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
  extra?: CommandExtra,
): Promise<{ session: StudySession; learningLog?: LearningLog }> {
  if (command === 'pause') {
    return {
      session: await studySessions.pause({
        sessionId: session.id,
        version: session.version,
        idempotencyKey,
      }),
    }
  }
  if (command === 'resume') {
    return {
      session: await studySessions.resume({
        sessionId: session.id,
        version: session.version,
        idempotencyKey,
      }),
    }
  }
  return studySessions.complete({
    sessionId: session.id,
    version: session.version,
    idempotencyKey,
    completionSource: extra?.completionSource ?? 'online',
    endedAt: extra?.endedAt,
    gains: extra?.gains,
    problems: extra?.problems,
    nextStep: extra?.nextStep,
  })
}

function parseSession(value: unknown): StudySession | null {
  const parsed = studySessionSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

function parseLearningLog(value: unknown): LearningLog | null {
  const parsed = learningLogSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}
