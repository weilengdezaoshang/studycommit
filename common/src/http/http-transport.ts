import type { HttpRequest } from './http-request'

export interface HttpTransport {
  request<TResponse>(request: HttpRequest<TResponse>): Promise<TResponse>
}
