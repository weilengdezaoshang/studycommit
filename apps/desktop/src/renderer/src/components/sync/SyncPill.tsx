import { useEffect, useState } from 'react'
import { usePapersState, papersActions } from '../../features/papers/papers-store'

/** 把 ISO 时刻渲染为「刚刚 / N 分钟前」;超过 1 小时后显示时刻本身。 */
export function formatSyncedAt(iso: string, now: number): string {
  const elapsedMs = now - new Date(iso).getTime()
  if (elapsedMs < 60_000) {
    return '刚刚'
  }
  const minutes = Math.floor(elapsedMs / 60_000)
  if (minutes < 60) {
    return `${minutes} 分钟前`
  }
  return new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

/**
 * 桌面端同步状态胶囊:同步中 / 已同步 / 同步失败 / 本地工作。
 * 数据来自 papers-store 的 syncing / source / lastSyncedAt / syncFailed。
 */
export function SyncPill(): React.JSX.Element {
  const { syncing, source, lastSyncedAt, syncFailed } = usePapersState()
  const [now, setNow] = useState(() => Date.now())

  // 「N 分钟前」需要随时间推进刷新;仅在展示相对时间时开启定时器
  useEffect(() => {
    if (source !== 'server' || !lastSyncedAt || syncing || syncFailed) {
      return
    }
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [source, lastSyncedAt, syncing, syncFailed])

  if (syncing) {
    return (
      <span className="sync-pill sync-pill--busy" role="status">
        <span className="sync-pill__spinner" aria-hidden="true" />
        同步中…
      </span>
    )
  }
  if (syncFailed) {
    return (
      <button
        type="button"
        className="sync-pill sync-pill--error"
        onClick={() => void papersActions.loadRemote()}
      >
        <i className="sync-pill__dot" aria-hidden="true" />
        同步失败 · 点击重试
      </button>
    )
  }
  if (source === 'server' && lastSyncedAt) {
    return (
      <span
        className="sync-pill sync-pill--ok"
        role="status"
        title={new Date(lastSyncedAt).toLocaleString('zh-CN')}
      >
        <i className="sync-pill__dot" aria-hidden="true" />
        已同步 · {formatSyncedAt(lastSyncedAt, now)}
      </span>
    )
  }
  return (
    <span className="sync-pill sync-pill--local" role="status">
      <i className="sync-pill__dot" aria-hidden="true" />
      本地工作
    </span>
  )
}
