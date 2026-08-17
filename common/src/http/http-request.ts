import type { ZodType } from 'zod'

export interface HttpRequest<TResponse> {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  headers?: Readonly<Record<string, string>>
  body?: unknown
  timeoutMs?: number
  signal?: AbortSignal
  responseSchema: ZodType<TResponse>
}
