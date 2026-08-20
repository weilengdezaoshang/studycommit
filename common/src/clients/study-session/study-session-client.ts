import {
  activeStudySessionResponseSchema,
  completeStudySessionInputSchema,
  completeStudySessionResultSchema,
  createStudySessionInputSchema,
  sessionCommandInputSchema,
  sessionIdSchema,
  studySessionSchema,
  type ActiveStudySessionResponse,
  type CompleteStudySessionInput,
  type CompleteStudySessionResult,
  type CreateStudySessionInput,
  type SessionCommandInput,
  type StudySession,
} from '../../contracts/study-session'
import { createHttpError, type HttpTransport } from '../../http'

export interface StudySessionApi {
  create(input: CreateStudySessionInput): Promise<StudySession>
  getActive(): Promise<ActiveStudySessionResponse>
  getById(sessionId: string): Promise<StudySession>
  pause(input: SessionCommandInput): Promise<StudySession>
  resume(input: SessionCommandInput): Promise<StudySession>
  complete(input: CompleteStudySessionInput): Promise<CompleteStudySessionResult>
}

export class StudySessionClient implements StudySessionApi {
  constructor(private readonly http: HttpTransport) {}

  create(rawInput: CreateStudySessionInput): Promise<StudySession> {
    const { idempotencyKey, ...body } = createStudySessionInputSchema.parse(rawInput)
    return this.http.request({
      method: 'POST',
      path: '/study-sessions',
      headers: { 'idempotency-key': idempotencyKey },
      body,
      responseSchema: studySessionSchema,
    })
  }

  getActive(): Promise<ActiveStudySessionResponse> {
    return this.http.request({
      method: 'GET',
      path: '/study-sessions/active',
      responseSchema: activeStudySessionResponseSchema,
    })
  }

  getById(rawSessionId: string): Promise<StudySession> {
    const sessionId = sessionIdSchema.parse(rawSessionId)
    return this.http.request({
      method: 'GET',
      path: `/study-sessions/${encodeURIComponent(sessionId)}`,
      responseSchema: studySessionSchema,
    })
  }

  pause(input: SessionCommandInput): Promise<StudySession> {
    return this.command('pause', sessionCommandInputSchema.parse(input))
  }

  resume(input: SessionCommandInput): Promise<StudySession> {
    return this.command('resume', sessionCommandInputSchema.parse(input))
  }

  complete(rawInput: CompleteStudySessionInput): Promise<CompleteStudySessionResult> {
    const parsed = completeStudySessionInputSchema.safeParse(rawInput)
    if (!parsed.success) {
      throw createHttpError({ code: 'INVALID_RESPONSE', message: '请求参数无效' })
    }
    const { sessionId, idempotencyKey, ...body } = parsed.data
    return this.http.request({
      method: 'POST',
      path: `/study-sessions/${encodeURIComponent(sessionId)}/complete`,
      headers: { 'idempotency-key': idempotencyKey },
      body,
      responseSchema: completeStudySessionResultSchema,
    })
  }

  private command(action: 'pause' | 'resume', input: SessionCommandInput): Promise<StudySession> {
    return this.http.request({
      method: 'POST',
      path: `/study-sessions/${encodeURIComponent(input.sessionId)}/${action}`,
      headers: { 'idempotency-key': input.idempotencyKey },
      body: { version: input.version },
      responseSchema: studySessionSchema,
    })
  }
}
