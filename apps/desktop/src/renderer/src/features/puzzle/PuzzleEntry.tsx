import { useEffect, useMemo, useState } from 'react'
import { CloudPuzzleExperience, type PuzzleCloudHost } from '@studycommit/puzzle-ui'
import { usePuzzleOverview } from '@studycommit/common/puzzle-react'
import { createOfflinePuzzleApi, type PuzzleSyncState } from '@studycommit/common/puzzle-runtime'
import { useAuthSession } from '../auth/session'
import { papersActions, usePapersState } from '../papers/papers-store'
import { Dialog } from '../../components/dialog/Dialog'
import './puzzle-entry.css'
import { unwrapIpcResult } from '../study-session/api/desktop-study-session-gateway'
export function PuzzleEntry() {
  const [open, setOpen] = useState(false)
  const [syncState, setSyncState] = useState<PuzzleSyncState>('synced')
  const session = useAuthSession(),
    data = usePapersState()
  const account = session?.user.id
  const host = useMemo<PuzzleCloudHost | null>(() => {
    const api = window.studyCommit.puzzles
    if (!api || !account) {
return null
}
    const cloud = createOfflinePuzzleApi({
      account,
      remote: {
        album: async () => unwrapIpcResult(await api.album()),
        selectArtwork: async (artworkId) => unwrapIpcResult(await api.selectArtwork(artworkId)),
        reveal: async (rewardId) => unwrapIpcResult(await api.reveal(rewardId)),
        featureArtwork: async (artworkId) => unwrapIpcResult(await api.featureArtwork(artworkId)),
      },
      storage: {
        get: async (key) => localStorage.getItem(key),
        set: async (key, value) => localStorage.setItem(key, value),
      },
      createId: () => crypto.randomUUID(),
      onState: setSyncState,
    })
    const strokesKey = (rewardId: string) => `studycommit.puzzle.strokes.v1.${account}.${rewardId}`
    return {
      album: cloud.album,
      selectArtwork: cloud.selectArtwork,
      reveal: async (rewardId) => {
        await cloud.reveal(rewardId)
        localStorage.removeItem(strokesKey(rewardId))
      },
      featureArtwork: cloud.featureArtwork,
      loadStrokes: async (rewardId) =>
        JSON.parse(localStorage.getItem(strokesKey(rewardId)) ?? '[]'),
      saveStrokes: async (rewardId, strokes) =>
        localStorage.setItem(strokesKey(rewardId), JSON.stringify(strokes)),
      organize: async (id, topic) => {
        if (!(await papersActions.organizePaper(id, topic))) {
          throw new Error('记录未能保存，请重试。')
        }
      },
    }
  }, [account])
  const summary = usePuzzleOverview(host?.album ?? null, Boolean(host))
  useEffect(() => {
    const sync = () => void summary.reload()
    window.addEventListener('online', sync)
    return () => window.removeEventListener('online', sync)
  }, [summary.reload])
  if (!account || data.source !== 'server' || !host) {
    return null
  }
  return (
    <>
      <button
        type="button"
        className={`puzzle-entry-card${summary.overview?.pendingRewardId ? ' has-reward' : ''}`}
        onClick={() => {
          if (syncState === 'failed') {
void summary.reload()
}
          setOpen(true)
        }}
        aria-label="打开拼图画册"
      >
        {summary.overview?.artwork?.assetUrl && (
          <img src={summary.overview.artwork.assetUrl} alt="" />
        )}
        <span>
          <strong>{summary.overview?.artwork?.title ?? '我的画册'}</strong>
          <small>
            {summary.loading
              ? '正在翻开…'
              : summary.error
                ? '点击重试'
                : syncState === 'pending'
                  ? '已离线保存 · 等待同步'
                  : syncState === 'failed'
                    ? '同步失败 · 点击重试'
                    : `${summary.overview?.progressText ?? '选一幅想收集的画'} · ${summary.overview?.actionText ?? '开始收集'}`}
          </small>
        </span>
        {summary.overview?.pendingRewardId && <b>待擦开</b>}
      </button>
      <Dialog
        open={open}
        title="我的拼图画册"
        className="puzzle-dialog"
        onClose={() => {
          setOpen(false)
          void summary.reload()
        }}
      >
        <CloudPuzzleExperience
          key={account}
          host={host}
          papers={data.papers}
          topics={data.topics.filter((t) => t.id !== '__inbox__')}
          onClose={() => {
            setOpen(false)
            void summary.reload()
          }}
        />
      </Dialog>
    </>
  )
}
