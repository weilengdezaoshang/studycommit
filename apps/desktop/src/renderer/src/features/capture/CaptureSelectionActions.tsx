import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { spacing } from '@studycommit/design-tokens'

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** 优先选区右下方；放不下则翻到上方，最后夹在视口安全边距内。 */
export function captureActionsPosition(
  rect: Rect | null,
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
) {
  const gap = spacing.smPlus
  const clamp = (value: number, extent: number, size: number) =>
    Math.max(gap, Math.min(value, extent - size - gap))
  if (!rect || rect.width < 1 || rect.height < 1) {
    return {
      left: clamp(viewportWidth - width - gap, viewportWidth, width),
      top: clamp(viewportHeight - height - gap, viewportHeight, height),
    }
  }
  const below = rect.y + rect.height + gap
  const top = below + height <= viewportHeight - gap ? below : rect.y - height - gap
  return {
    left: clamp(rect.x + rect.width - width, viewportWidth, width),
    top: clamp(top, viewportHeight, height),
  }
}

export function CaptureSelectionActions({
  rect,
  children,
}: {
  rect: Rect | null
  children: ReactNode
}) {
  const element = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const panel = element.current
    if (!panel) {
      return
    }
    const position = () => {
      const next = captureActionsPosition(
        rect,
        panel.offsetWidth,
        panel.offsetHeight,
        window.innerWidth,
        window.innerHeight,
      )
      panel.style.left = `${next.left}px`
      panel.style.top = `${next.top}px`
    }
    position()
    const observer = new ResizeObserver(position)
    observer.observe(panel)
    window.addEventListener('resize', position)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', position)
    }
  }, [rect])
  return (
    <div
      ref={element}
      className="capture-selection-actions"
      onMouseDown={(event) => event.stopPropagation()}
    >
      {children}
    </div>
  )
}
