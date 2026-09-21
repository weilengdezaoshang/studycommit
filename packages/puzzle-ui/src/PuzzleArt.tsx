import { useId } from 'react'
import { piecePath, pieceBox } from '@studycommit/common/puzzle-runtime'
export function PuzzleArt({
  pieces,
  piece,
  highlight,
  complete = false,
  assetUrl,
  title = '拼图画作',
}: {
  pieces?: number[]
  piece?: number
  highlight?: number | null
  complete?: boolean
  assetKey?: string
  assetUrl?: string
  title?: string
}) {
  const id = useId().replace(/:/g, '')
  const box = piece === undefined ? null : pieceBox(piece)
  const visible = piece === undefined ? (pieces ?? []) : [piece]
  const source = assetUrl
  return (
    <svg
      className="puzzle-art"
      viewBox={box ? `${box.x} ${box.y} 140 140` : '0 0 400 300'}
      aria-label={
        piece === undefined
          ? `${title}，已拼好 ${visible.length} / 12 块`
          : `本次获得的${title}拼图碎片`
      }
      role="img"
    >
      <defs>
        {visible.map((i) => (
          <clipPath key={i} id={`${id}-${i}`}>
            <path d={piecePath(i)} />
          </clipPath>
        ))}
      </defs>
      {piece === undefined && <rect width="400" height="300" fill="var(--p-paper)" />}
      {visible.map((i) => (
        <image
          key={i}
          href={source}
          width="400"
          height="300"
          preserveAspectRatio="none"
          clipPath={`url(#${id}-${i})`}
        />
      ))}
      {(piece === undefined ? Array.from({ length: 12 }, (_, i) => i) : [piece]).map((i) => (
        <path
          data-piece={i}
          key={i}
          d={piecePath(i)}
          fill="none"
          stroke={highlight === i ? 'var(--p-action)' : 'var(--p-line)'}
          strokeWidth={highlight === i ? 2 : 0.65}
          className={complete ? 'puzzle-seam puzzle-seam--complete' : 'puzzle-seam'}
        />
      ))}
    </svg>
  )
}
