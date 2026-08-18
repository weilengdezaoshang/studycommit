import { createContext, useContext, useMemo, type PropsWithChildren } from 'react'
import {
  createDesktopStudySessionGateway,
  createDesktopTopicGateway,
  type StudySessionGateway,
  type TopicGateway,
} from './desktop-study-session-gateway'

export interface DesktopRendererServices {
  studySessions: StudySessionGateway
  topics: TopicGateway
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
