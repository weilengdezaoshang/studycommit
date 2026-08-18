import { createContext, useContext, useMemo, type PropsWithChildren } from 'react'
import {
  resolveMobileServices,
  type MobileServices,
} from '../infrastructure/http/create-mobile-services'

const MobileServicesContext = createContext<MobileServices | null>(null)

export function MobileServicesProvider({
  children,
  services,
}: PropsWithChildren<{ services?: MobileServices }>) {
  const parent = useContext(MobileServicesContext)
  const value = useMemo(() => services ?? parent ?? resolveMobileServices(), [parent, services])
  return <MobileServicesContext.Provider value={value}>{children}</MobileServicesContext.Provider>
}

export function useMobileServices(): MobileServices {
  const services = useContext(MobileServicesContext)
  if (!services) {
    throw new Error('MobileServicesProvider 未就绪')
  }
  return services
}
