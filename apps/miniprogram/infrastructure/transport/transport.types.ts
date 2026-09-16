/** 统一调用选项：幂等键、取消信号与超时；两种传输实现都必须支持。 */
export interface TransportCallOptions {
  idempotencyKey?: string
  signal?: AbortSignal
  timeoutMs?: number
}

/**
 * 小程序统一业务传输口：页面与业务 Store 只看 operation 名，
 * 不感知云函数名、HTTP 路径或请求信封。
 */
export interface MiniprogramTransport {
  call<TInput, TOutput>(
    operation: string,
    input: TInput,
    options?: TransportCallOptions,
  ): Promise<TOutput>
}

/** 单个业务操作的传输元数据。 */
export interface OperationRoute {
  /** 写操作不允许传输层自动回退重放，读操作在明确配置下允许。 */
  kind: 'read' | 'write'
  /** HTTP 传输路由；缺省表示该操作仅云函数可用。 */
  http?: {
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
    /** 静态路径或由输入生成路径（如 /papers/{id}）。 */
    path: string | ((input: unknown) => string)
    /** GET 查询参数展开。 */
    query?: (input: unknown) => Record<string, string | number | undefined>
    /** 免登录公共接口（登录/刷新）。 */
    access?: 'public' | 'authed'
  }
}

export type OperationRegistry = Record<string, OperationRoute>
