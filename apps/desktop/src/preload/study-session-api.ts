import { ipcRenderer } from 'electron'
import { aiIpcChannels } from '../shared/ai-channels'
import { authIpcChannels } from '../shared/auth-channels'
import { learningLogIpcChannels } from '../shared/learning-log-channels'
import { studySessionIpcChannels } from '../shared/study-session-channels'
import { paperIpcChannels } from '../shared/paper-channels'
import { topicIpcChannels } from '../shared/topic-channels'
import { captureIpcChannels } from '../shared/capture-channels'

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
  update: (input: unknown) => ipcRenderer.invoke(topicIpcChannels.update, input),
  remove: (input: unknown) => ipcRenderer.invoke(topicIpcChannels.remove, input),
}

export const paperPreloadApi = {
  list: (input?: unknown) => ipcRenderer.invoke(paperIpcChannels.list, input),
  create: (input: unknown) => ipcRenderer.invoke(paperIpcChannels.create, input),
  update: (input: unknown) => ipcRenderer.invoke(paperIpcChannels.update, input),
  organize: (input: unknown) => ipcRenderer.invoke(paperIpcChannels.organize, input),
  moveToInbox: (input: unknown) => ipcRenderer.invoke(paperIpcChannels.moveToInbox, input),
  remove: (input: unknown) => ipcRenderer.invoke(paperIpcChannels.remove, input),
  question: (input: unknown) => ipcRenderer.invoke(paperIpcChannels.question, input),
  restore: (input: unknown) => ipcRenderer.invoke(paperIpcChannels.restore, input),
}

export const learningLogPreloadApi = {
  list: (input?: unknown) => ipcRenderer.invoke(learningLogIpcChannels.list, input),
  getBySession: (sessionId: string) =>
    ipcRenderer.invoke(learningLogIpcChannels.getBySession, sessionId),
  update: (input: unknown) => ipcRenderer.invoke(learningLogIpcChannels.update, input),
}

export const aiPreloadApi = {
  explainPaper: (input: unknown) => ipcRenderer.invoke(aiIpcChannels.explainPaper, input),
  confirmPaperExplain: (input: unknown) =>
    ipcRenderer.invoke(aiIpcChannels.confirmPaperExplain, input),
}

export const authPreloadApi = {
  registerAccount: (input: unknown) => ipcRenderer.invoke(authIpcChannels.registerAccount, input),
  loginAccount: (input: unknown) => ipcRenderer.invoke(authIpcChannels.loginAccount, input),
}

export const capturePreloadApi = {
  permissionCheck: () => ipcRenderer.invoke(captureIpcChannels.permissionCheck),
  openPermissionSettings: () => ipcRenderer.invoke(captureIpcChannels.openPermissionSettings),
  request: () => ipcRenderer.invoke(captureIpcChannels.request),
  confirm: (input: unknown) => ipcRenderer.invoke(captureIpcChannels.confirm, input),
  cancel: (input: unknown) => ipcRenderer.invoke(captureIpcChannels.cancel, input),
  /** 快捷键截图完成推送(主窗口无 invoke 挂起时接收) */
  onRequestResult: (listener: (result: unknown) => void) => {
    const wrapped = (_event: unknown, result: unknown) => listener(result)
    ipcRenderer.on(captureIpcChannels.requestResult, wrapped)
    return () => {
      ipcRenderer.removeListener(captureIpcChannels.requestResult, wrapped)
    }
  },
  // 以下三个仅供覆盖窗路由使用;sender 由主进程校验
  overlayReady: () => ipcRenderer.invoke(captureIpcChannels.overlayReady),
  overlaySelection: (input: unknown) =>
    ipcRenderer.invoke(captureIpcChannels.overlaySelection, input),
  overlayCancel: () => ipcRenderer.invoke(captureIpcChannels.overlayCancel),
  onOverlayState: (listener: (state: unknown) => void) => {
    const wrapped = (_event: unknown, state: unknown) => listener(state)
    ipcRenderer.on(captureIpcChannels.overlayState, wrapped)
    return () => {
      ipcRenderer.removeListener(captureIpcChannels.overlayState, wrapped)
    }
  },
}

export const studyCommitPreloadApi = {
  platform: process.platform,
  studySessions: studySessionPreloadApi,
  topics: topicPreloadApi,
  learningLogs: learningLogPreloadApi,
  papers: paperPreloadApi,
  ai: aiPreloadApi,
  auth: authPreloadApi,
  capture: capturePreloadApi,
}
