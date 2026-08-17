import type { StudySession } from './study-session.schema'

export const runningStudySessionFixture: StudySession = {
  id: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  topicId: '33333333-3333-4333-8333-333333333333',
  goal: '理解 Electron 跨进程请求流程',
  status: 'running',
  startedAt: '2026-08-17T08:00:00.000Z',
  pausedAt: null,
  totalPausedSeconds: 0,
  completedAt: null,
  durationSeconds: null,
  completionSource: null,
  version: 1,
  createdAt: '2026-08-17T08:00:00.000Z',
  updatedAt: '2026-08-17T08:00:00.000Z',
}

export const pausedStudySessionFixture: StudySession = {
  ...runningStudySessionFixture,
  status: 'paused',
  pausedAt: '2026-08-17T08:20:00.000Z',
  version: 2,
  updatedAt: '2026-08-17T08:20:00.000Z',
}

export const completedStudySessionFixture: StudySession = {
  ...runningStudySessionFixture,
  status: 'completed',
  completedAt: '2026-08-17T08:30:00.000Z',
  durationSeconds: 1800,
  completionSource: 'online',
  version: 2,
  updatedAt: '2026-08-17T08:30:00.000Z',
}
