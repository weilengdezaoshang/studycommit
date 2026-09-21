import { describe, it, expect } from 'vitest'
import {
  emptyPuzzle,
  recordOrganized,
  selectGroup,
  validateState,
  piecePath,
  pieceBox,
  puzzleOverview,
  scratchCoverage,
  canvasTouchPoint,
  scratchCellKey,
  type PuzzlePaper,
  type PuzzleState,
} from './index'
const now = new Date(2026, 8, 17, 12)
const paper = (id: string, date = '2026-09-15T00:00:00Z'): PuzzlePaper => ({
  id,
  content: '记录',
  status: 'inbox',
  createdAt: date,
})
describe('puzzle-runtime', () => {
  it('刮擦优先使用画布坐标并按画布尺寸分格', () => {
    expect(canvasTouchPoint({ x: 40, y: 30, clientX: 400, clientY: 300 })).toEqual({ x: 40, y: 30 })
    expect(canvasTouchPoint({ clientX: 400, clientY: 300 })).toEqual({ x: 300, y: 220 })
    expect(scratchCellKey(40, 30)).toBe('1:1')
  })
  it('优先选最早的三条旧记录并排除跳过及当天记录', () => {
    expect(
      selectGroup(
        [
          paper('b'),
          paper('a', '2026-09-14T00:00:00Z'),
          paper('c'),
          paper('d'),
          paper('today', now.toISOString()),
        ],
        now,
        ['b'],
      ).map((p) => p.id),
    ).toEqual(['a', 'c', 'd'])
  })
  it('跨次累计三条才发一块且同一记录不重复累计', () => {
    let s = recordOrganized(emptyPuzzle(), paper('1'), now, 0)
    s = recordOrganized(s, paper('1'), now, 0)
    expect(s.credit).toBe(1)
    s = recordOrganized(s, paper('2'), now, 0)
    expect(s.pending).toBeNull()
    s = recordOrganized(s, paper('3'), now, 0)
    expect(s.earned).toEqual([0])
    expect(s.pending).toBe(0)
    expect(s.credit).toBe(0)
  })
  it('当天新建及已经整理的记录不产生奖励', () => {
    expect(recordOrganized(emptyPuzzle(), paper('today', now.toISOString()), now, 0).credit).toBe(0)
    expect(
      recordOrganized(emptyPuzzle(), { ...paper('1'), status: 'organized' }, now, 0).credit,
    ).toBe(0)
  })
  it('每日最多一块且不将超额整理积攒为次日奖励', () => {
    let s = emptyPuzzle()
    for (let i = 0; i < 9; i++) {
      s = recordOrganized(s, paper(String(i)), now, 0.4)
    }
    expect(s.earned).toHaveLength(1)
    expect(s.credit).toBe(0)
    expect(s.counted).toHaveLength(9)
  })
  it('次日随机只抽未拥有的块且首块编号零可以恢复', () => {
    let s: PuzzleState = {
      ...emptyPuzzle(),
      earned: [0],
      pending: null,
      lastRewardDay: '2026-09-16',
      credit: 2,
    }
    s = recordOrganized(s, paper('1'), now, 0)
    expect(s.earned).toEqual([0, 1])
    expect(validateState({ ...s, pending: 0 }).pending).toBe(0)
  })
  it('集齐后仍可整理但不重复发奖', () => {
    const s = recordOrganized(
      { ...emptyPuzzle(), earned: Array.from({ length: 12 }, (_, i) => i) },
      paper('x'),
      now,
      0.5,
    )
    expect(s.earned).toHaveLength(12)
    expect(s.credit).toBe(0)
  })
  it('拒绝损坏及越界的本地奖励数据', () => {
    expect(() => validateState({ ...emptyPuzzle(), earned: [1, 1] })).toThrow()
    expect(() => validateState({ ...emptyPuzzle(), pending: 2 })).toThrow()
    expect(() => validateState({ ...emptyPuzzle(), strokes: [{ x: NaN, y: 0 }] })).toThrow()
  })
  it('每块保持固定全图坐标且覆盖率不因反复擦同一点累加', () => {
    expect(piecePath(9)).toContain('M100 200')
    expect(pieceBox(9)).toEqual({ x: 80, y: 180, width: 140, height: 140 })
    const p = { x: 70, y: 70, start: true }
    expect(scratchCoverage(Array(50).fill(p))).toBe(scratchCoverage([p]))
    expect(
      scratchCoverage([
        { x: 25, y: 25, start: true },
        { x: 115, y: 115 },
      ]),
    ).toBeGreaterThan(scratchCoverage([p]))
  })
  it('生成跨端一致的首页收集摘要', () => {
    const artwork = {
      id: '71000000-0000-4000-8000-000000000001',
      slug: 'spring-rabbit',
      title: '春日来信',
      description: '',
      assetKey: 'spring-rabbit',
      assetUrl: 'http://localhost/spring-rabbit.png',
      version: 1,
      pieceCount: 12 as const,
      status: 'published' as const,
      collectedCount: 0,
      completedAt: null,
      featured: false,
    }
    const overview = puzzleOverview({
      selectedArtworkId: artwork.id,
      featuredArtworkId: null,
      credit: 2,
      artworks: [artwork],
      rewards: [
        {
          id: '72000000-0000-4000-8000-000000000001',
          artworkId: artwork.id,
          pieceIndex: 1,
          earnedAt: '2026-09-20T00:00:00.000Z',
          revealedAt: '2026-09-20T00:01:00.000Z',
        },
        {
          id: '72000000-0000-4000-8000-000000000002',
          artworkId: artwork.id,
          pieceIndex: 2,
          earnedAt: '2026-09-20T00:02:00.000Z',
          revealedAt: null,
        },
      ],
    })
    expect(overview.progressText).toBe('1 / 12')
    expect(overview.actionText).toBe('擦开一小块')
    expect(overview.pendingRewardId).toBe('72000000-0000-4000-8000-000000000002')
  })
})
