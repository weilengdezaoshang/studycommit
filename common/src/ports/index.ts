/**
 * Stable business capabilities consumed by application shells.
 * Protocol-specific clients must implement these ports instead of leaking
 * REST, RPC, or platform transport details into UI and hooks.
 */
export type { LearningLogApi } from '../clients/learning-log/learning-log-client'
export type { StudySessionApi } from '../clients/study-session/study-session-client'
export type { TopicApi, TopicQueryApi } from '../clients/topic/topic-client'
