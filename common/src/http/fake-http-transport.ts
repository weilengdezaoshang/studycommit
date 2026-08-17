import type { HttpRequest } from './http-request'
import type { HttpTransport } from './http-transport'

export class FakeHttpTransport implements HttpTransport {
  readonly requests: HttpRequest<unknown>[] = []

  constructor(
    private readonly responder: (request: HttpRequest<unknown>) => unknown | Promise<unknown>,
  ) {}

  async request<TResponse>(request: HttpRequest<TResponse>): Promise<TResponse> {
    this.requests.push(request as HttpRequest<unknown>)
    return request.responseSchema.parse(await this.responder(request as HttpRequest<unknown>))
  }
}
