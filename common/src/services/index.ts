import { createRestServices, type RestServices } from '../adapters/rest'
import type { HttpTransport } from '../http'

export type ApplicationServices = RestServices

export type ServiceFactoryOptions = {
  transport: 'rest'
  httpTransport: HttpTransport
}

/**
 * The application-level composition point. Add the oRPC branch here when its
 * client is introduced; platform shells should not select adapters directly.
 */
export function createServices(options: ServiceFactoryOptions): ApplicationServices {
  return createRestServices(options.httpTransport)
}
