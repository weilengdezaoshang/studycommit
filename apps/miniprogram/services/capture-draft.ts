import {
  normalizeCaptureState,
  type CaptureImage,
  type CaptureState,
} from '../shared/capture-runtime/index'
import { getStoredSession } from './auth-session'

const accountId = () => getStoredSession()?.user.id ?? 'local-development'
const key = () => `studycommit.capture.draft.v1:${accountId()}`
const queues = new Map<string, Promise<void>>()

function enqueue(storageKey: string, operation: () => Promise<void>): Promise<void> {
  const task = (queues.get(storageKey) ?? Promise.resolve()).catch(() => undefined).then(operation)
  queues.set(storageKey, task)
  return task.finally(() => {
    if (queues.get(storageKey) === task) {
      queues.delete(storageKey)
    }
  })
}

function exists(path: string): Promise<boolean> {
  return new Promise((resolve) => {
    wx.getFileSystemManager().access({
      path,
      success: () => resolve(true),
      fail: () => resolve(false),
    })
  })
}

function persist(path: string): Promise<string> {
  if (path.startsWith(wx.env.USER_DATA_PATH)) {
    return Promise.resolve(path)
  }
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().saveFile({
      tempFilePath: path,
      success: (result) => resolve(result.savedFilePath),
      fail: reject,
    })
  })
}

export async function loadCaptureDraft(): Promise<CaptureState | null> {
  const storageKey = key()
  const raw = wx.getStorageSync(storageKey)
  if (typeof raw !== 'string' || !raw) {
    return null
  }
  try {
    const state = JSON.parse(raw) as CaptureState
    const images: CaptureImage[] = []
    for (const image of state.images) {
      images.push({
        ...image,
        version: image.version || 1,
        status: image.status === 'working' ? 'waiting' : image.status,
        missing: !(await exists(image.uri)),
      })
    }
    return { ...normalizeCaptureState({ ...state, images }), recovery: true }
  } catch {
    wx.removeStorageSync(storageKey)
    return null
  }
}

export async function saveCaptureDraft(state: CaptureState): Promise<void> {
  const storageKey = key()
  await enqueue(storageKey, async () => {
    const images: CaptureImage[] = []
    for (const image of state.images) {
      try {
        images.push({ ...image, uri: await persist(image.uri), missing: false })
      } catch {
        images.push({ ...image, missing: true })
      }
    }
    wx.setStorageSync(
      storageKey,
      JSON.stringify({ ...state, images, activeRunId: null, recovery: false }),
    )
  })
}

export async function clearCaptureDraft(state?: CaptureState): Promise<void> {
  const storageKey = key()
  await enqueue(storageKey, async () => {
    const raw = wx.getStorageSync(storageKey)
    let stored: CaptureState | null = null
    try {
      stored = typeof raw === 'string' && raw ? (JSON.parse(raw) as CaptureState) : null
    } catch {
      stored = null
    }
    const images = [...(state?.images ?? []), ...(stored?.images ?? [])]
    for (const image of images) {
      if (image.uri.startsWith(wx.env.USER_DATA_PATH)) {
        wx.getFileSystemManager().unlink({ filePath: image.uri, fail: () => undefined })
      }
    }
    wx.removeStorageSync(storageKey)
  })
}
