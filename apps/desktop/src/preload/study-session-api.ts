import { ipcRenderer } from 'electron'
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

export const studyCommitPreloadApi = {
  platform: process.platform,
  studySessions: studySessionPreloadApi,
  topics: topicPreloadApi,
}
