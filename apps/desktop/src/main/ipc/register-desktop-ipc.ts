import type { DesktopServices } from '../composition/create-services'
import { IpcHost } from './ipc-host'
import { registerAiIpc } from './ai-ipc'
import { registerAuthIpc } from './auth-ipc'
import { registerLearningLogIpc } from './learning-log-ipc'
import { registerPaperIpc } from './paper-ipc'
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
  registerPaperIpc(host, services.papers)
  registerAuthIpc(host, services.auth)
  registerAiIpc(host, services.ai)
  return () => {
    host.dispose()
  }
}
