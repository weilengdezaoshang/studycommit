import type {
  ActiveStudySessionResponse,
  CompleteStudySessionInput,
  CompleteStudySessionResult,
  SessionCommandInput,
  StudySession,
} from '@studycommit/common/contracts'
import {
  activeSessionResponseSchema,
  completeSessionResultSchema,
  studySessionSchema,
} from '@studycommit/rpc-contracts/study-sessions'
import type { MiniprogramTransport } from '../transport/transport.types'

/** 小程序学习会话服务：覆盖开始/查看/暂停/恢复/完成核心链路。 */
export interface StudySessionsService {
  create(input: Record<string, unknown> & { idempotencyKey?: string }): Promise<StudySession>
  getActive(): Promise<ActiveStudySessionResponse>
  getById(sessionId: string): Promise<StudySession>
  pause(input: SessionCommandInput): Promise<StudySession>
  resume(input: SessionCommandInput): Promise<StudySession>
  complete(input: CompleteStudySessionInput): Promise<CompleteStudySessionResult>
}

export function createStudySessionsService(transport: MiniprogramTransport): StudySessionsService {
  return {
    async create(input) {
      const { idempotencyKey, ...body } = input
      return transport
        .call('studySessions.create', body, { idempotencyKey })
        .then((value) => studySessionSchema.parse(value))
    },
    getActive() {
      return transport
        .call('studySessions.getActive', {})
        .then((value) => activeSessionResponseSchema.parse(value))
    },
    getById(sessionId) {
      return transport
        .call('studySessions.get', { sessionId })
        .then((value) => studySessionSchema.parse(value))
    },
    pause(input) {
      // 契约要求调用方生成幂等键；确定性键会让同一会话的第二次暂停撞上 409 去重。
      return transport
        .call('studySessions.pause', input, { idempotencyKey: input.idempotencyKey })
        .then((value) => studySessionSchema.parse(value))
    },
    resume(input) {
      return transport
        .call('studySessions.resume', input, { idempotencyKey: input.idempotencyKey })
        .then((value) => studySessionSchema.parse(value))
    },
    complete(input) {
      const { idempotencyKey, ...body } = input
      return transport
        .call('studySessions.complete', body, { idempotencyKey })
        .then((value) => completeSessionResultSchema.parse(value))
    },
  }
}
