import type { LearningLog } from './learning-log.schema'
import { completedStudySessionFixture } from '../study-session/study-session.fixture'

export const emptyLearningLogFixture: LearningLog = {
  id: '55555555-5555-4555-8555-555555555555',
  userId: completedStudySessionFixture.userId,
  sessionId: completedStudySessionFixture.id,
  topicId: '33333333-3333-4333-8333-333333333333',
  gains: null,
  problems: null,
  nextStep: null,
  effectiveDurationSeconds: completedStudySessionFixture.durationSeconds ?? 0,
  version: 1,
  createdAt: completedStudySessionFixture.completedAt ?? completedStudySessionFixture.updatedAt,
  updatedAt: completedStudySessionFixture.updatedAt,
}

export const completeStudySessionResultFixture = {
  session: completedStudySessionFixture,
  learningLog: emptyLearningLogFixture,
}
