import { net } from 'electron'
import { JsonHttpTransport, type JsonHttpTransportOptions } from '@studycommit/common/http'

export type ElectronNetTransportOptions = Omit<JsonHttpTransportOptions, 'fetchImpl'> & {
  fetchImpl?: typeof fetch
}

export class ElectronNetTransport extends JsonHttpTransport {
  constructor(options: ElectronNetTransportOptions) {
    super({
      ...options,
      fetchImpl: options.fetchImpl ?? ((input, init) => net.fetch(String(input), init)),
    })
  }
}
