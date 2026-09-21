import { createRoot } from 'react-dom/client'
import { CloudPuzzleExperience, type PuzzleCloudHost } from '../src'
import type { PuzzlePaper, PuzzleTopic, ScratchPoint } from '@studycommit/common/puzzle-runtime'
import type { PuzzleAlbum } from '@studycommit/rpc-contracts/puzzles'
declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (s: string) => void }
    __puzzleReceive?: (m: Message) => void
  }
}
type Message =
  | { type: 'init'; papers: PuzzlePaper[]; topics: PuzzleTopic[] }
  | { type: 'reply'; id: number; value?: unknown; error?: string }
const pending = new Map<
  number,
  {
    resolve: (v: unknown) => void
    reject: (e: Error) => void
    timer: ReturnType<typeof setTimeout>
  }
>()
let seq = 0
function post(value: unknown) {
  window.ReactNativeWebView?.postMessage(JSON.stringify(value))
}
function request(method: string, args: unknown[] = []): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = ++seq
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error('连接超时，请关闭画册后重试。'))
    }, 20000)
    pending.set(id, { resolve, reject, timer })
    post({ type: 'request', id, method, args })
  })
}
const host: PuzzleCloudHost = {
  album: () => request('album') as Promise<PuzzleAlbum>,
  selectArtwork: (artworkId) => request('selectArtwork', [artworkId]) as Promise<PuzzleAlbum>,
  organize: async (id, topic) => {
    await request('organize', [id, topic])
  },
  reveal: async (rewardId) => {
    await request('reveal', [rewardId])
  },
  featureArtwork: (artworkId) => request('featureArtwork', [artworkId]) as Promise<PuzzleAlbum>,
  loadStrokes: (rewardId) => request('loadStrokes', [rewardId]) as Promise<ScratchPoint[]>,
  saveStrokes: async (rewardId, strokes) => {
    await request('saveStrokes', [rewardId, strokes])
  },
}
const root = createRoot(document.getElementById('root')!)
window.__puzzleReceive = (m) => {
  if (m.type === 'init') {
    root.render(
      <CloudPuzzleExperience
        host={host}
        papers={m.papers}
        topics={m.topics}
        onClose={() => post({ type: 'close' })}
      />,
    )
  } else {
    const p = pending.get(m.id)
    if (!p) {
      return
    }
    clearTimeout(p.timer)
    pending.delete(m.id)
    if (m.error) {
      p.reject(new Error(m.error))
    } else {
      p.resolve(m.value)
    }
  }
}
post({ type: 'ready' })
