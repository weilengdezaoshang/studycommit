import type { PuzzleAlbum, PuzzleReward } from '@studycommit/rpc-contracts/puzzles'

export type PuzzleSyncState = 'synced' | 'pending' | 'failed'
export type PuzzleStorage = {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
}
export type PuzzleRemote = {
  album(): Promise<PuzzleAlbum>
  selectArtwork(artworkId: string): Promise<PuzzleAlbum>
  reveal(rewardId: string): Promise<PuzzleReward>
  featureArtwork(artworkId: string): Promise<PuzzleAlbum>
}
type PendingOperation = {
  id: string
  method: 'selectArtwork' | 'reveal' | 'featureArtwork'
  value: string
}

/** 服务端操作均为幂等设置；队列 ID 用于本地去重和调试追踪。 */
export function createOfflinePuzzleApi(input: {
  account: string
  remote: PuzzleRemote
  storage: PuzzleStorage
  createId: () => string
  onState?: (state: PuzzleSyncState) => void
}): PuzzleRemote & { sync(): Promise<PuzzleAlbum | null> } {
  const base = `studycommit.puzzle.cloud.v1.${input.account}`
  const albumKey = `${base}.album`
  const queueKey = `${base}.queue`
  const read = async <T>(key: string, fallback: T): Promise<T> => {
    const raw = await input.storage.get(key)
    if (!raw) {
return fallback
}
    try {
      return JSON.parse(raw) as T
    } catch {
      return fallback
    }
  }
  const saveAlbum = async (album: PuzzleAlbum) => {
    await input.storage.set(albumKey, JSON.stringify(album))
    return album
  }
  const enqueue = async (method: PendingOperation['method'], value: string) => {
    const queue = await read<PendingOperation[]>(queueKey, [])
    if (!queue.some((item) => item.method === method && item.value === value)) {
      queue.push({ id: input.createId(), method, value })
      await input.storage.set(queueKey, JSON.stringify(queue))
    }
    input.onState?.('pending')
  }
  const sync = async () => {
    const queue = await read<PendingOperation[]>(queueKey, [])
    try {
      for (const operation of queue) {
        if (operation.method === 'selectArtwork') {
await input.remote.selectArtwork(operation.value)
}
        if (operation.method === 'reveal') {
await input.remote.reveal(operation.value)
}
        if (operation.method === 'featureArtwork') {
await input.remote.featureArtwork(operation.value)
}
      }
      if (queue.length) {
await input.storage.set(queueKey, '[]')
}
      const album = await saveAlbum(await input.remote.album())
      input.onState?.('synced')
      return album
    } catch {
      input.onState?.(queue.length ? 'failed' : 'synced')
      return null
    }
  }
  const cached = async () => read<PuzzleAlbum | null>(albumKey, null)
  return {
    sync,
    album: async () =>
      (await sync()) ?? (await cached()) ?? Promise.reject(new Error('画册暂时无法读取')),
    selectArtwork: async (artworkId) => {
      try {
        return await saveAlbum(await input.remote.selectArtwork(artworkId))
      } catch {
        const album = await cached()
        if (!album) {
throw new Error('请联网后选择画作')
}
        await enqueue('selectArtwork', artworkId)
        return saveAlbum({ ...album, selectedArtworkId: artworkId })
      }
    },
    reveal: async (rewardId) => {
      try {
        return await input.remote.reveal(rewardId)
      } catch {
        const album = await cached()
        const reward = album?.rewards.find((item) => item.id === rewardId)
        if (!album || !reward) {
throw new Error('碎片暂时无法保存')
}
        const revealed = { ...reward, revealedAt: new Date().toISOString() }
        await saveAlbum({
          ...album,
          rewards: album.rewards.map((item) => (item.id === rewardId ? revealed : item)),
        })
        await enqueue('reveal', rewardId)
        return revealed
      }
    },
    featureArtwork: async (artworkId) => {
      try {
        return await saveAlbum(await input.remote.featureArtwork(artworkId))
      } catch {
        const album = await cached()
        if (!album?.artworks.some((item) => item.id === artworkId && item.completedAt)) {
throw new Error('作品尚未完成')
}
        await enqueue('featureArtwork', artworkId)
        return saveAlbum({
          ...album,
          featuredArtworkId: artworkId,
          artworks: album.artworks.map((item) => ({ ...item, featured: item.id === artworkId })),
        })
      }
    },
  }
}
