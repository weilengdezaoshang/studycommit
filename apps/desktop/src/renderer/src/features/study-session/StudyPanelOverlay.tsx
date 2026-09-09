import { useEffect } from 'react'
import type { StudySessionController } from '@studycommit/common/study-session-react'
import { SessionPanel } from './components/SessionPanel'
import { useCompletePaperHandler } from './use-complete-paper'

/**
 * 学习面板(R70/R71):非模态浮层,可继续操作后面的记录;
 * 隐藏不结束学习,Esc 或关闭按钮收起。
 */
export function StudyPanelOverlay({
  study,
  onClose,
}: {
  study: StudySessionController
  onClose: () => void
}): React.JSX.Element {
  const onCompletePaper = useCompletePaperHandler(study)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="study-overlay" role="dialog" aria-label="学习面板">
      <section className="study-overlay__panel">
        <header className="study-overlay__bar">
          <h2>继续学习</h2>
          <button
            type="button"
            className="study-overlay__close"
            aria-label="收起学习面板"
            onClick={onClose}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>
        <div className="study-overlay__body">
          <SessionPanel
            session={study.session!}
            serverNow={study.serverNow}
            topicName={study.topicName}
            pendingCommand={study.pendingCommand}
            learningLog={study.learningLog}
            onPause={study.pause}
            onResume={study.resume}
            onComplete={study.complete}
            onCompletePaper={onCompletePaper}
            onOpenMiniWindow={() => window.studyCommit.mini.open()}
            onBackToStart={onClose}
          />
        </div>
      </section>
    </div>
  )
}
