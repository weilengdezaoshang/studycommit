import { contextBridge } from 'electron'
import { studyCommitPreloadApi } from './study-session-api'

contextBridge.exposeInMainWorld('studyCommit', studyCommitPreloadApi)
