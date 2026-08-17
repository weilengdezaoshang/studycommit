import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('studyCommit', {
  platform: process.platform,
})
