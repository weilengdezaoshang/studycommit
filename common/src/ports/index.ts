/**
 * Stable business capabilities consumed by application shells.
 * Protocol-specific clients must implement these ports instead of leaking
 * REST, RPC, or platform transport details into UI and hooks.
 */
export type {
  ApplicationServices,
  LearningLogApi,
  PaperApi,
  StudySessionApi,
  TopicApi,
  TopicMutationApi,
  TopicQueryApi,
  RemoveTopicInput,
  RemoveTopicOutput,
  UpdateTopicInput,
} from './application-services'
export type { AiApi } from './ai'
export type { ReviewApi } from './review'
export type {
  AssetAccessOutput,
  AssetKind,
  AssetMimeType,
  CompleteUploadOutput,
  CreateUploadOutput,
  UploadsApi,
} from './uploads'
