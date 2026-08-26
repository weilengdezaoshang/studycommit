import type { DeskItemLayout } from '../contracts/growth'

export type DeskItemBounds = { width: number; height: number }

export function clampDeskItem(layout: DeskItemLayout, bounds: DeskItemBounds): DeskItemLayout {
  const halfWidth = Math.min((bounds.width * layout.scale) / 2, 0.5)
  const halfHeight = Math.min((bounds.height * layout.scale) / 2, 0.5)
  return {
    ...layout,
    x: Math.min(1 - halfWidth, Math.max(halfWidth, layout.x)),
    y: Math.min(1 - halfHeight, Math.max(halfHeight, layout.y)),
  }
}

export function snapDeskCoordinate(value: number, target: number, threshold = 0.025): number {
  return Math.abs(value - target) <= threshold ? target : value
}

export function deskLayoutReducer(
  state: DeskItemLayout[],
  action:
    | { type: 'upsert'; item: DeskItemLayout }
    | { type: 'remove'; itemId: string }
    | { type: 'reset'; items: DeskItemLayout[] },
): DeskItemLayout[] {
  if (action.type === 'reset') {
    return action.items
  }
  if (action.type === 'remove') {
    return state.filter((item) => item.itemId !== action.itemId)
  }
  const found = state.some((item) => item.itemId === action.item.itemId)
  return found
    ? state.map((item) => (item.itemId === action.item.itemId ? action.item : item))
    : [...state, action.item]
}
