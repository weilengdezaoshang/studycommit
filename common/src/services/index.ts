import { createRestServices } from '../adapters/rest'
import { createOrpcServices, type OrpcRawClient } from '../adapters/orpc'
import type { HttpTransport } from '../http'
import type { ApplicationServices } from '../ports'

export type { ApplicationServices }

export type ServiceFactoryOptions =
  | {
      transport: 'rest'
      httpTransport: HttpTransport
    }
  | {
      transport: 'orpc'
      orpcClient: OrpcRawClient
    }

/**
 * The application-level composition point. Platform shells select a protocol
 * here rather than constructing adapters directly.
 */
export function createServices(options: ServiceFactoryOptions): ApplicationServices {
  if (options.transport === 'orpc') {
    return createOrpcServices(options.orpcClient)
  }
  return createRestServices(options.httpTransport)
}
