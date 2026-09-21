export function getMenuPosition(
  anchor: { left: number; top: number; bottom: number; width: number },
  viewport: { width: number; height: number },
  contentHeight: number,
) {
  const margin = 8
  const gap = 6
  const width = Math.min(Math.max(anchor.width, 160), Math.max(0, viewport.width - margin * 2))
  const below = Math.max(0, viewport.height - anchor.bottom - gap - margin)
  const above = Math.max(0, anchor.top - gap - margin)
  const desired = Math.min(contentHeight, 280)
  const opensUp = below < desired && above > below
  const maxHeight = Math.min(desired, opensUp ? above : below)
  return {
    left: Math.max(margin, Math.min(anchor.left, viewport.width - width - margin)),
    top: opensUp
      ? Math.max(margin, anchor.top - gap - maxHeight)
      : Math.min(viewport.height - margin, anchor.bottom + gap),
    width,
    maxHeight,
    placement: opensUp ? 'top' : 'bottom',
  } as const
}
