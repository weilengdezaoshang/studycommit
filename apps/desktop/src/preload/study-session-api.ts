import { ipcRenderer } from 'electron'
import { authIpcChannels } from '../shared/auth-channels'
import { learningLogIpcChannels } from '../shared/learning-log-channels'
import { studySessionIpcChannels } from '../shared/study-session-channels'
import { paperIpcChannels } from '../shared/paper-channels'
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
  create: (input: unknown) => ipcRenderer.invoke(topicIpcChannels.create, input),
}

export const paperPreloadApi = {
  list: (input?: unknown) => ipcRenderer.invoke(paperIpcChannels.list, input),
  create: (input: unknown) => ipcRenderer.invoke(paperIpcChannels.create, input),
  update: (input: unknown) => ipcRenderer.invoke(paperIpcChannels.update, input),
  organize: (input: unknown) => ipcRenderer.invoke(paperIpcChannels.organize, input),
  moveToInbox: (input: unknown) => ipcRenderer.invoke(paperIpcChannels.moveToInbox, input),
  remove: (input: unknown) => ipcRenderer.invoke(paperIpcChannels.remove, input),
}

export const learningLogPreloadApi = {
  list: (input?: unknown) => ipcRenderer.invoke(learningLogIpcChannels.list, input),
  getBySession: (sessionId: string) =>
    ipcRenderer.invoke(learningLogIpcChannels.getBySession, sessionId),
  update: (input: unknown) => ipcRenderer.invoke(learningLogIpcChannels.update, input),
}

export const authPreloadApi = {
  registerAccount: (input: unknown) => ipcRenderer.invoke(authIpcChannels.registerAccount, input),
  loginAccount: (input: unknown) => ipcRenderer.invoke(authIpcChannels.loginAccount, input),
}

export const studyCommitPreloadApi = {
  platform: process.platform,
  studySessions: studySessionPreloadApi,
  topics: topicPreloadApi,
  learningLogs: learningLogPreloadApi,
  papers: paperPreloadApi,
  auth: authPreloadApi,
}
