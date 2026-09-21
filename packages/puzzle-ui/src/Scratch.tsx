import { useEffect, useRef } from 'react'
import {
  piecePath,
  pieceBox,
  scratchCoverage,
  type ScratchPoint,
} from '@studycommit/common/puzzle-runtime'
import { PuzzleArt } from './PuzzleArt'
import { studyCommitMistBlueColors as colors } from '@studycommit/design-tokens'
export function Scratch({
  piece,
  strokes,
  revealing,
  onSave,
  onReveal,
  artwork,
}: {
  piece: number
  strokes: ScratchPoint[]
  revealing: boolean
  onSave: (p: ScratchPoint[]) => void
  onReveal: () => void
  artwork?: { assetKey: string; title: string; assetUrl?: string }
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const points = useRef([...strokes])
  const drawing = useRef(false)
  const fired = useRef(false)
  useEffect(() => {
    const c = canvas.current,
      ctx = c?.getContext('2d')
    if (!ctx || !c) {
      return
    }
    const scale = 3
    c.width = 420
    c.height = 420
    ctx.scale(scale, scale)
    const b = pieceBox(piece)
    ctx.save()
    ctx.translate(-b.x, -b.y)
    ctx.clip(new Path2D(piecePath(piece)))
    ctx.translate(b.x, b.y)
    ctx.fillStyle = colors.accent
    ctx.fillRect(0, 0, 140, 140)
    ctx.strokeStyle = colors.lineStrong
    ctx.lineWidth = 0.45
    for (let i = -140; i < 280; i += 2.7) {
      ctx.beginPath()
      ctx.moveTo(i + Math.sin(i) * 1.5, 0)
      ctx.lineTo(i + 65 + Math.cos(i) * 2, 70)
      ctx.lineTo(i + 140, 140)
      ctx.stroke()
    }
    ctx.restore()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.lineWidth = 22
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    points.current.forEach((p, i) => {
      const prev = !p.start && i ? points.current[i - 1] : p
      ctx.beginPath()
      ctx.moveTo(prev.x, prev.y)
      ctx.lineTo(p.x + 0.01, p.y + 0.01)
      ctx.stroke()
    })
    if (scratchCoverage(points.current) >= 0.5 && !fired.current) {
      fired.current = true
      onReveal()
    }
    // 原始擦除点仅在挂载时恢复，手势不触发 React 逐帧渲染。
  }, [piece, onReveal])
  const paint = (event: React.PointerEvent<HTMLCanvasElement>, start = false) => {
    if (revealing || fired.current || points.current.length >= 1600) {
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    const p = {
      x: Math.max(0, Math.min(140, ((event.clientX - rect.left) / rect.width) * 140)),
      y: Math.max(0, Math.min(140, ((event.clientY - rect.top) / rect.height) * 140)),
      start,
    }
    const prev = start ? p : (points.current.at(-1) ?? p)
    if (!start && Math.hypot(p.x - prev.x, p.y - prev.y) < 1.5) {
      return
    }
    points.current.push(p)
    const ctx = canvas.current?.getContext('2d')
    if (ctx) {
      ctx.beginPath()
      ctx.moveTo(prev.x, prev.y)
      ctx.lineTo(p.x + 0.01, p.y + 0.01)
      ctx.stroke()
    }
    if (points.current.length % 6 === 0 && scratchCoverage(points.current) >= 0.5) {
      fired.current = true
      onSave([...points.current])
      onReveal()
    }
  }
  return (
    <div className="puzzle-scratch">
      <PuzzleArt
        piece={piece}
        assetKey={artwork?.assetKey}
        assetUrl={artwork?.assetUrl}
        title={artwork?.title}
      />
      <canvas
        ref={canvas}
        className={revealing ? 'puzzle-coating is-revealed' : 'puzzle-coating'}
        aria-hidden="true"
        onPointerDown={(e) => {
          if (revealing) {
            return
          }
          drawing.current = true
          e.currentTarget.setPointerCapture(e.pointerId)
          paint(e, true)
        }}
        onPointerMove={(e) => {
          if (drawing.current) {
            paint(e)
          }
        }}
        onPointerUp={() => {
          drawing.current = false
          onSave([...points.current])
        }}
        onPointerCancel={() => {
          drawing.current = false
          onSave([...points.current])
        }}
        onLostPointerCapture={() => {
          if (drawing.current) {
            drawing.current = false
            onSave([...points.current])
          }
        }}
      />
    </div>
  )
}
