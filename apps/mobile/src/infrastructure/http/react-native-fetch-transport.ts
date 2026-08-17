import { JsonHttpTransport, type JsonHttpTransportOptions } from '@studycommit/common/http'

export type ReactNativeFetchTransportOptions = Omit<JsonHttpTransportOptions, 'fetchImpl'> & {
  fetchImpl?: typeof fetch
}

export class ReactNativeFetchTransport extends JsonHttpTransport {
  constructor(options: ReactNativeFetchTransportOptions) {
    super({
      ...options,
      fetchImpl: options.fetchImpl ?? fetch,
    })
  }
}
