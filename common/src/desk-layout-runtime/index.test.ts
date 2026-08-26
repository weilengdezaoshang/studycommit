import { describe, expect, it } from 'vitest'
import { clampDeskItem, deskLayoutReducer, snapDeskCoordinate } from './index'

const item = {
  itemId: '11111111-1111-4111-8111-111111111111',
  zone: 'desktop' as const,
  x: 0,
  y: 1,
  rotation: 0,
  scale: 1,
  zIndex: 1,
  flipped: false,
}

describe('desk layout runtime', () => {
  it('clamps items to the normalized scene bounds', () => {
    expect(clampDeskItem(item, { width: 0.2, height: 0.2 })).toMatchObject({ x: 0.1, y: 0.9 })
    expect(snapDeskCoordinate(0.49, 0.5)).toBe(0.5)
  })

  it('supports reversible layout updates', () => {
    const next = deskLayoutReducer([], { type: 'upsert', item })
    expect(deskLayoutReducer(next, { type: 'remove', itemId: item.itemId })).toEqual([])
  })
})
