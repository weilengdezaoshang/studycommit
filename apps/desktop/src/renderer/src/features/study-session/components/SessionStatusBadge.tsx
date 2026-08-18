import type { StudySession } from '@studycommit/common/contracts'

const LABELS: Record<StudySession['status'], string> = {
  running: '正在学习',
  paused: '已暂停',
  completed: '已完成',
}

export function SessionStatusBadge({
  status,
}: {
  status: StudySession['status']
}): React.JSX.Element {
  return (
    <span className={`session-status session-status--${status}`} aria-live="polite">
      {LABELS[status]}
    </span>
  )
}
