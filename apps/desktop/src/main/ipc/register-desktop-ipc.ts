import type { DesktopServices } from '../composition/create-services'
import { IpcHost } from './ipc-host'
import { registerAuthIpc } from './auth-ipc'
import { registerLearningLogIpc } from './learning-log-ipc'
import { registerStudySessionIpc } from './study-session-ipc'
import { registerTopicIpc } from './topic-ipc'
import type { TrustedIpcSenderOptions } from './validate-ipc-sender'

export function registerDesktopIpc(
  services: DesktopServices,
  trust: TrustedIpcSenderOptions,
): () => void {
  const host = new IpcHost(trust)
  registerStudySessionIpc(host, services.studySessions)
  registerTopicIpc(host, services.topics)
  registerLearningLogIpc(host, services.learningLogs)
  registerAuthIpc(host, services.auth)
  return () => {
    host.dispose()
  }
}
