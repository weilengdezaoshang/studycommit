/** 平台无关的拼图几何、奖励规则与恢复契约。 */
import type { PuzzleAlbum, PuzzleArtwork } from '@studycommit/rpc-contracts/puzzles'
export * from './offline'

export const PIECE_COUNT = 12
export type PuzzlePaper = {
  id: string
  content: string
  status: string
  createdAt: string
  deletedAt?: string | null
  topicId?: string | null
}
export type PuzzleTopic = { id: string; name: string }
export type ScratchPoint = { x: number; y: number; start?: boolean }

/** 小程序刮涂层画布逻辑尺寸，与 pages/puzzle 的 600rpx×440rpx 对应。 */
export const MINIPROGRAM_SCRATCH_CANVAS = { width: 300, height: 220, cellWidth: 30, cellHeight: 28 }

/** 优先用画布相对坐标；旧事件只有 page 坐标时再回退。 */
export function canvasTouchPoint(
  touch: { x?: number; y?: number; clientX?: number; clientY?: number },
  canvas = MINIPROGRAM_SCRATCH_CANVAS,
): { x: number; y: number } {
  const x = typeof touch.x === 'number' ? touch.x : (touch.clientX ?? 0)
  const y = typeof touch.y === 'number' ? touch.y : (touch.clientY ?? 0)
  return {
    x: Math.max(0, Math.min(canvas.width, x)),
    y: Math.max(0, Math.min(canvas.height, y)),
  }
}

export function scratchCellKey(x: number, y: number, canvas = MINIPROGRAM_SCRATCH_CANVAS): string {
  return `${Math.floor(x / canvas.cellWidth)}:${Math.floor(y / canvas.cellHeight)}`
}
export type PuzzleOverview = {
  artwork: PuzzleArtwork | null
  revealedCount: number
  pendingRewardId: string | null
  remainingToReward: number
  progressText: string
  actionText: string
}

export function puzzleOverview(album: PuzzleAlbum): PuzzleOverview {
  const selected = album.artworks.find((item) => item.id === album.selectedArtworkId) ?? null
  const selectedPending = album.rewards.find(
    (reward) => reward.artworkId === selected?.id && reward.revealedAt === null,
  )
  const artwork =
    (selectedPending
      ? selected
      : album.artworks.find((item) => item.id === album.featuredArtworkId)) ?? selected
  const rewards = artwork ? album.rewards.filter((reward) => reward.artworkId === artwork.id) : []
  const pending = selectedPending ?? rewards.find((reward) => reward.revealedAt === null)
  const revealedCount = rewards.filter((reward) => reward.revealedAt !== null).length
  const remainingToReward = pending ? 0 : Math.max(0, 3 - album.credit)
  return {
    artwork,
    revealedCount,
    pendingRewardId: pending?.id ?? null,
    remainingToReward,
    progressText: artwork ? `${revealedCount} / ${PIECE_COUNT}` : '还未选择画作',
    actionText: pending ? '擦开一小块' : `再整理 ${remainingToReward} 条获得一块`,
  }
}
export type PuzzleState = {
  version: 1
  counted: string[]
  credit: number
  earned: number[]
  lastRewardDay: string | null
  pending: number | null
  strokes: ScratchPoint[]
  intent: { paper: PuzzlePaper; topicId: string } | null
}
export const emptyPuzzle = (): PuzzleState => ({
  version: 1,
  counted: [],
  credit: 0,
  earned: [],
  lastRewardDay: null,
  pending: null,
  strokes: [],
  intent: null,
})
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function eligible(paper: PuzzlePaper, now: Date): boolean {
  return (
    !paper.deletedAt &&
    paper.status === 'inbox' &&
    Number.isFinite(Date.parse(paper.createdAt)) &&
    dayKey(new Date(paper.createdAt)) < dayKey(now)
  )
}
export function selectGroup(
  papers: PuzzlePaper[],
  now: Date,
  skipped: string[] = [],
): PuzzlePaper[] {
  return papers
    .filter((p) => eligible(p, now) && !skipped.includes(p.id))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id))
    .slice(0, 3)
}
export function recordOrganized(
  state: PuzzleState,
  paper: PuzzlePaper,
  now: Date,
  random: number,
): PuzzleState {
  if (!eligible(paper, now) || state.counted.includes(paper.id)) {
    return { ...state, intent: null }
  }
  const next = { ...state, counted: [...state.counted, paper.id], intent: null }
  if (
    state.pending !== null ||
    state.lastRewardDay === dayKey(now) ||
    state.earned.length === PIECE_COUNT
  ) {
    return next
  }
  next.credit = state.credit + 1
  if (next.credit < 3) {
    return next
  }
  const pool = Array.from({ length: PIECE_COUNT }, (_, i) => i).filter(
    (i) => !state.earned.includes(i),
  )
  const piece =
    pool[Math.min(pool.length - 1, Math.floor(Math.max(0, Math.min(1, random)) * pool.length))]
  return {
    ...next,
    credit: 0,
    earned: [...state.earned, piece],
    pending: piece,
    strokes: [],
    lastRewardDay: dayKey(now),
  }
}
export function validateState(value: unknown): PuzzleState {
  const s = value as PuzzleState
  if (
    !s ||
    s.version !== 1 ||
    !Array.isArray(s.counted) ||
    !s.counted.every((v) => typeof v === 'string') ||
    !Number.isInteger(s.credit) ||
    s.credit < 0 ||
    s.credit > 2 ||
    !Array.isArray(s.earned) ||
    !s.earned.every((v) => Number.isInteger(v) && v >= 0 && v < PIECE_COUNT) ||
    new Set(s.earned).size !== s.earned.length ||
    (s.pending !== null && !s.earned.includes(s.pending)) ||
    (s.lastRewardDay !== null && !/^\d{4}-\d{2}-\d{2}$/.test(s.lastRewardDay)) ||
    !Array.isArray(s.strokes) ||
    s.strokes.length > 1600 ||
    !s.strokes.every(
      (p) =>
        Number.isFinite(p.x) &&
        Number.isFinite(p.y) &&
        p.x >= 0 &&
        p.y >= 0 &&
        p.x <= 140 &&
        p.y <= 140,
    )
  ) {
    throw new Error('画册数据无法读取，请保留本机数据并重试。')
  }
  if (
    s.intent &&
    (!s.intent.paper?.id || !s.intent.paper.createdAt || typeof s.intent.topicId !== 'string')
  ) {
    throw new Error('整理恢复数据无效')
  }
  return s
}

// 每条相邻边共用同一个方向，反向遍历后凹凸严格吻合。
export function piecePath(index: number): string {
  const col = index % 4,
    row = Math.floor(index / 4)
  const x = col * 100,
    y = row * 100
  const edge = (sx: number, sy: number, dx: number, dy: number, tab: number) => {
    if (!tab) {
      return `L${sx + dx} ${sy + dy}`
    }
    const point = (t: number, n: number) => `${sx + dx * t - dy * n} ${sy + dy * t + dx * n}`
    return `L${point(0.35, 0)} C${point(0.4, 0)} ${point(0.3, 0.18 * tab)} ${point(0.5, 0.18 * tab)} C${point(0.7, 0.18 * tab)} ${point(0.6, 0)} ${point(0.65, 0)} L${point(1, 0)}`
  }
  return `M${x} ${y} ${edge(x, y, 100, 0, row ? 1 : 0)} ${edge(x + 100, y, 0, 100, col < 3 ? 1 : 0)} ${edge(x + 100, y + 100, -100, 0, row < 2 ? -1 : 0)} ${edge(x, y + 100, 0, -100, col ? -1 : 0)} Z`
}
export function pieceBox(index: number) {
  return { x: (index % 4) * 100 - 20, y: Math.floor(index / 4) * 100 - 20, width: 140, height: 140 }
}
export function inPiece(index: number, x: number, y: number): boolean {
  // 覆盖率使用主体内采样，凹凸边缘不要求擦净。
  return index >= 0 && x >= 24 && x <= 116 && y >= 24 && y <= 116
}
export function scratchCoverage(points: ScratchPoint[]): number {
  let hit = 0,
    total = 0
  for (let y = 25; y <= 115; y += 5) {
    for (let x = 25; x <= 115; x += 5) {
      total++
      if (
        points.some((p, i) => {
          const prev = !p.start && i > 0 ? points[i - 1] : p
          const dx = p.x - prev.x,
            dy = p.y - prev.y,
            len = dx * dx + dy * dy
          const t = len
            ? Math.max(0, Math.min(1, ((x - prev.x) * dx + (y - prev.y) * dy) / len))
            : 0
          return Math.hypot(x - prev.x - t * dx, y - prev.y - t * dy) <= 11
        })
      ) {
        hit++
      }
    }
  }
  return hit / total
}
