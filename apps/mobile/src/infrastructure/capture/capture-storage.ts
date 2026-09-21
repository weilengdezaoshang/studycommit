import AsyncStorage from '@react-native-async-storage/async-storage'
import { Directory, File, Paths } from 'expo-file-system'
import type {
  CaptureDraftPort,
  CaptureImage,
  CaptureMediaPort,
  CaptureState,
} from '@studycommit/common/capture-runtime'
import { normalizeCaptureState } from '@studycommit/common/capture-runtime'

const keyOf = (accountId: string) => `studycommit.capture.draft.v1:${accountId}`
const safeAccount = (accountId: string) => accountId.replace(/[^a-zA-Z0-9_-]/g, '_')
const saveQueues = new Map<string, Promise<void>>()

function directoryOf(accountId: string) {
  const root = new Directory(Paths.document, 'capture-drafts')
  if (!root.exists) {
    root.create({ intermediates: true, idempotent: true })
  }
  const account = new Directory(root, safeAccount(accountId))
  if (!account.exists) {
    account.create({ intermediates: true, idempotent: true })
  }
  return account
}

export const mobileCaptureMediaPort: CaptureMediaPort = {
  async persist(image, accountId) {
    const source = new File(image.uri)
    if (!source.exists) {
      return { ...image, missing: true }
    }
    const extension = source.extension || '.jpg'
    const destination = new File(
      directoryOf(accountId),
      `${image.id}-v${image.version}${extension}`,
    )
    if (!destination.exists) {
      await source.copy(destination)
    }
    return { ...image, uri: destination.uri, sizeBytes: destination.size, missing: false }
  },
  async remove(image) {
    const file = new File(image.uri)
    if (file.exists && image.uri.startsWith(Paths.document.uri)) {
      file.delete()
    }
  },
}

export const mobileCaptureDraftPort: CaptureDraftPort = {
  async load(accountId) {
    const raw = await AsyncStorage.getItem(keyOf(accountId))
    if (!raw) {
      return null
    }
    try {
      const state = JSON.parse(raw) as CaptureState
      return {
        ...normalizeCaptureState(state),
        activeRunId: null,
        images: state.images.map((image) => ({
          ...image,
          status: image.status === 'working' ? 'waiting' : image.status,
          missing: !new File(image.uri).exists,
        })),
        recovery: true,
      }
    } catch {
      await AsyncStorage.removeItem(keyOf(accountId))
      return null
    }
  },
  async save(accountId, state) {
    const previous = saveQueues.get(accountId) ?? Promise.resolve()
    const task = previous
      .catch(() => undefined)
      .then(async () => {
        const images: CaptureImage[] = []
        for (const image of state.images) {
          images.push(await mobileCaptureMediaPort.persist(image, accountId))
        }
        await AsyncStorage.setItem(
          keyOf(accountId),
          JSON.stringify({ ...state, images, activeRunId: null, recovery: false }),
        )
      })
    saveQueues.set(accountId, task)
    try {
      await task
    } finally {
      if (saveQueues.get(accountId) === task) {
        saveQueues.delete(accountId)
      }
    }
  },
  async clear(accountId) {
    await saveQueues.get(accountId)?.catch(() => undefined)
    await AsyncStorage.removeItem(keyOf(accountId))
    const directory = directoryOf(accountId)
    if (directory.exists) {
      directory.delete()
    }
  },
}
