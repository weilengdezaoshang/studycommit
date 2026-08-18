import type { StudySession } from '@studycommit/common/contracts'
import { AppText } from '../../../components/AppText'

const LABELS: Record<StudySession['status'], string> = {
  running: '正在学习',
  paused: '已暂停',
  completed: '已完成',
}

export function SessionStatusBadge({ status }: { status: StudySession['status'] }) {
  return (
    <AppText accessibilityLiveRegion="polite" color="muted" variant="caption" weight="medium">
      {LABELS[status]}
    </AppText>
  )
}
