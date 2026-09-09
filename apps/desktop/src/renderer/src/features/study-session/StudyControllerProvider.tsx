import { createContext, useContext, type PropsWithChildren } from 'react'
import type { StudySessionController } from '@studycommit/common/study-session-react'

const StudyControllerContext = createContext<StudySessionController | null>(null)

/** 学习会话控制器只在 AppShell 创建一次;主页与学习面板共用,避免双份轮询。 */
export function StudyControllerProvider({
  controller,
  children,
}: PropsWithChildren<{ controller: StudySessionController }>): React.JSX.Element {
  return (
    <StudyControllerContext.Provider value={controller}>{children}</StudyControllerContext.Provider>
  )
}

/** 未接入控制器时返回 null(调用方自行降级隐藏入口)。 */
export function useStudyController(): StudySessionController | null {
  return useContext(StudyControllerContext)
}
