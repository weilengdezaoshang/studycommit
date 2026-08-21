import { ipcRenderer } from 'electron'
import { learningLogIpcChannels } from '../shared/learning-log-channels'
import { studySessionIpcChannels } from '../shared/study-session-channels'
import { topicIpcChannels } from '../shared/topic-channels'

export const studySessionPreloadApi = {
  create: (input: unknown) => ipcRenderer.invoke(studySessionIpcChannels.create, input),
  getActive: () => ipcRenderer.invoke(studySessionIpcChannels.getActive),
  getById: (sessionId: string) => ipcRenderer.invoke(studySessionIpcChannels.getById, sessionId),
  pause: (input: unknown) => ipcRenderer.invoke(studySessionIpcChannels.pause, input),
  resume: (input: unknown) => ipcRenderer.invoke(studySessionIpcChannels.resume, input),
  complete: (input: unknown) => ipcRenderer.invoke(studySessionIpcChannels.complete, input),
}

export const topicPreloadApi = {
  listActive: (input?: unknown) => ipcRenderer.invoke(topicIpcChannels.listActive, input),
}

export const learningLogPreloadApi = {
  getBySession: (sessionId: string) =>
    ipcRenderer.invoke(learningLogIpcChannels.getBySession, sessionId),
  update: (input: unknown) => ipcRenderer.invoke(learningLogIpcChannels.update, input),
}

export const studyCommitPreloadApi = {
  platform: process.platform,
  studySessions: studySessionPreloadApi,
  topics: topicPreloadApi,
  learningLogs: learningLogPreloadApi,
}
