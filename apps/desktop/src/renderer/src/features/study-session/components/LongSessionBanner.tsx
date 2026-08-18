export function LongSessionBanner({
  paused,
  onContinue,
  onComplete,
  onCorrectEndTime,
}: {
  paused: boolean
  onContinue: () => void
  onComplete: () => void
  onCorrectEndTime: () => void
}): React.JSX.Element {
  return (
    <aside className="study-banner" role="status">
      <p>本次学习已持续较长时间，仍在学习吗？</p>
      <div className="study-banner__actions">
        <button type="button" className="button" onClick={onContinue}>
          {paused ? '继续学习' : '仍在学习'}
        </button>
        <button type="button" className="button button--secondary" onClick={onComplete}>
          结束学习
        </button>
        <button type="button" className="button button--ghost" onClick={onCorrectEndTime}>
          修正结束时间
        </button>
      </div>
    </aside>
  )
}
