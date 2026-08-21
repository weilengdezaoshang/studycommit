import { createContext, useContext, useMemo, type PropsWithChildren } from 'react'
import {
  createDesktopLearningLogGateway,
  createDesktopStudySessionGateway,
  createDesktopTopicGateway,
  type LearningLogGateway,
  type StudySessionGateway,
  type TopicGateway,
} from './desktop-study-session-gateway'

export interface DesktopRendererServices {
  studySessions: StudySessionGateway
  topics: TopicGateway
  learningLogs: LearningLogGateway
}

const DesktopServicesContext = createContext<DesktopRendererServices | null>(null)

export function DesktopServicesProvider({
  children,
  services,
}: PropsWithChildren<{ services?: DesktopRendererServices }>): React.JSX.Element {
  const parent = useContext(DesktopServicesContext)
  const value = useMemo(
    () =>
      services ??
      parent ?? {
        studySessions: createDesktopStudySessionGateway(),
        topics: createDesktopTopicGateway(),
        learningLogs: createDesktopLearningLogGateway(),
      },
    [parent, services],
  )
  return <DesktopServicesContext.Provider value={value}>{children}</DesktopServicesContext.Provider>
}

export function useDesktopServices(): DesktopRendererServices {
  const services = useContext(DesktopServicesContext)
  if (!services) {
    throw new Error('DesktopServicesProvider 未就绪')
  }
  return services
}
