import { useEffect, useRef, useState } from 'react'
import { motion } from '@studycommit/design-tokens'
import { usePuzzleReveal } from '@studycommit/common/puzzle-react'
import { pieceBox, type PuzzleState, type ScratchPoint } from '@studycommit/common/puzzle-runtime'
import { PuzzleArt } from './PuzzleArt'
import { Scratch } from './Scratch'
const timings = {
  reveal: motion.puzzleReveal,
  hold: motion.puzzleHold,
  target: motion.puzzleTarget,
  flight: motion.puzzleFlight,
  settle: motion.puzzleSettle,
}
export function Reward({
  state,
  onSave,
  onFinish,
  onContinue,
  onAlbum,
  artwork,
}: {
  state: PuzzleState
  onSave: (p: ScratchPoint[]) => void
  onFinish: () => Promise<void>
  onContinue: () => void
  onAlbum: () => void
  artwork?: { assetKey: string; title: string; assetUrl?: string }
}) {
  const [piece] = useState(state.pending!)
  const [reduced, setReduced] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const m = matchMedia('(prefers-reduced-motion: reduce)')
    const change = () =>
      setReduced(m.matches || document.documentElement.classList.contains('reduce-motion'))
    m.addEventListener('change', change)
    window.addEventListener('puzzle-reduced-motion', change)
    change()
    return () => {
      m.removeEventListener('change', change)
      window.removeEventListener('puzzle-reduced-motion', change)
    }
  }, [])
  const { phase, reveal } = usePuzzleReveal(reduced, timings)
  const source = useRef<HTMLDivElement>(null),
    board = useRef<HTMLDivElement>(null),
    flyer = useRef<HTMLDivElement>(null)
  const continueButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (phase === 'done' && state.pending === null) {
      continueButton.current?.focus()
    }
  }, [phase, state.pending])
  const oldPieces = state.earned.filter((i) => i !== piece)
  const landed = phase === 'settling' || phase === 'done'
  useEffect(() => {
    if (phase !== 'flying' || !source.current || !board.current || !flyer.current) {
      return
    }
    const from = source.current.getBoundingClientRect(),
      to = board.current.getBoundingClientRect(),
      box = pieceBox(piece),
      node = flyer.current
    const size = (to.width / 400) * 140
    Object.assign(node.style, {
      position: 'fixed',
      left: `${from.left}px`,
      top: `${from.top}px`,
      width: `${from.width}px`,
      height: `${from.height}px`,
      visibility: 'visible',
    })
    const animation = node.animate(
      [
        { transform: 'translate(0,0) scale(1)' },
        {
          transform: `translate(${to.left + (box.x * to.width) / 400 - from.left}px,${to.top + (box.y * to.height) / 300 - from.top}px) scale(${size / from.width})`,
        },
      ],
      { duration: motion.puzzleFlight, easing: 'cubic-bezier(.23,1,.32,1)', fill: 'forwards' },
    )
    return () => {
      animation.cancel()
      node.style.visibility = 'hidden'
    }
  }, [phase, piece])
  useEffect(() => {
    if (phase === 'done') {
      void onFinish()
    }
  }, [phase, onFinish])
  // 重排只发生在落位后，使用 FLIP 保持画作空间连续。
  const previous = useRef<DOMRect | null>(null)
  useEffect(() => {
    if (!board.current) {
      return
    }
    const next = board.current.getBoundingClientRect()
    const old = previous.current
    previous.current = next
    if (landed && old && !reduced) {
      const a = board.current.animate(
        [
          {
            transform: `translate(${old.left - next.left}px,${old.top - next.top}px) scale(${old.width / next.width})`,
          },
          { transform: 'none' },
        ],
        { duration: motion.puzzleSettle, easing: 'cubic-bezier(.23,1,.32,1)' },
      )
      return () => a.cancel()
    }
  }, [landed, reduced])
  return (
    <>
      <p className="puzzle-kicker">✓ 已累计整理 3 条记录</p>
      <h2 aria-live="polite">{landed ? '又拼好了一小块' : '擦开今天的一小块'}</h2>
      <div className={`puzzle-reward-layout ${landed ? 'is-landed' : ''}`}>
        {!landed && (
          <div className="puzzle-source-area">
            <div
              ref={source}
              className={phase === 'flying' ? 'puzzle-source is-flying' : 'puzzle-source'}
            >
              <Scratch
                piece={piece}
                strokes={state.strokes}
                revealing={phase !== 'covered'}
                onSave={onSave}
                onReveal={reveal}
                artwork={artwork}
              />
            </div>
            <div className="puzzle-scratch-help">
              <span>{phase === 'covered' ? '按住并轻轻擦开' : '正在拼回画里…'}</span>
              <button className="puzzle-link" onClick={reveal} disabled={phase !== 'covered'}>
                直接揭晓
              </button>
            </div>
          </div>
        )}
        <div className="puzzle-destination">
          <div ref={board} className="puzzle-board">
            <PuzzleArt
              assetKey={artwork?.assetKey}
              assetUrl={artwork?.assetUrl}
              title={artwork?.title}
              pieces={landed ? state.earned : oldPieces}
              highlight={
                phase === 'target' || phase === 'flying' || phase === 'settling' ? piece : null
              }
              complete={phase === 'done' && state.earned.length === 12}
            />
          </div>
          <p aria-live="polite">
            {artwork?.title ?? '窗边睡猫'} · 已拼好{' '}
            {landed ? state.earned.length : oldPieces.length} / 12 块
          </p>
        </div>
      </div>
      <div ref={flyer} className="puzzle-flyer" aria-hidden="true">
        <PuzzleArt
          piece={piece}
          assetKey={artwork?.assetKey}
          assetUrl={artwork?.assetUrl}
          title={artwork?.title}
        />
      </div>
      {landed ? (
        <footer className="puzzle-footer">
          <span>
            {state.earned.length === 12 ? '这一幅，已经完整收藏。' : '小小的整理，留下了一点风景。'}
          </span>
          <div>
            <button ref={continueButton} onClick={onContinue} disabled={state.pending !== null}>
              继续整理
            </button>
            <button className="puzzle-primary" onClick={onAlbum} disabled={state.pending !== null}>
              看看画册
            </button>
            {state.pending !== null && phase === 'done' && (
              <button onClick={() => void onFinish()}>重试保存</button>
            )}
          </div>
        </footer>
      ) : (
        <p className="puzzle-footnote">碎片已保存，关闭后也能继续揭晓。</p>
      )}
    </>
  )
}
