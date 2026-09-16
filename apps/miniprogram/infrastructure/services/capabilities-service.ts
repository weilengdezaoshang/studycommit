import {
  defaultClientCapabilities,
  mergeClientCapabilities,
  type ClientCapabilities,
  type MiniprogramBackendMode,
} from '../../shared/service-runtime/index'
import type { MiniprogramTransport } from '../transport/transport.types'

export const CAPABILITIES_STORAGE_KEY = 'studycommit.capabilities.v1'

export interface CapabilitiesStorage {
  get(key: string): unknown
  set(key: string, value: ClientCapabilities): void
}

const wxCapabilitiesStorage: CapabilitiesStorage = {
  get(key) {
    try {
      return wx.getStorageSync(key) || undefined
    } catch {
      return undefined
    }
  },
  set(key, value) {
    try {
      wx.setStorageSync(key, JSON.parse(JSON.stringify(value)))
    } catch {
      // 能力缓存失败不影响使用本地默认值。
    }
  },
}

export interface CapabilitiesService {
  /** 当前生效能力（服务端覆盖 > 本地缓存 > 本地默认）。 */
  get(): ClientCapabilities
  /** 启动后刷新：服务端能力开关具有最终决定权。 */
  refresh(): Promise<ClientCapabilities>
}

export interface CreateCapabilitiesServiceOptions {
  mode: MiniprogramBackendMode
  transport: MiniprogramTransport
  storage?: CapabilitiesStorage
}

export function createCapabilitiesService(
  options: CreateCapabilitiesServiceOptions,
): CapabilitiesService {
  const storage = options.storage ?? wxCapabilitiesStorage
  const fallback = defaultClientCapabilities(options.mode)
  let current: ClientCapabilities = readCache() ?? fallback

  function readCache(): ClientCapabilities | undefined {
    const cached = storage.get(CAPABILITIES_STORAGE_KEY)
    if (!cached || typeof cached !== 'object') {
      return undefined
    }
    // 缓存只信合法字段；backendMode 以本地启动配置为准，避免与当前传输不一致。
    return mergeClientCapabilities({ ...fallback, backendMode: options.mode }, cached)
  }

  return {
    get() {
      return current
    },
    async refresh() {
      if (options.mode !== 'cloud-function') {
        // HTTP 模式暂无能力接口：使用本地默认并保持入口开关。
        current = fallback
        return current
      }
      try {
        const patch = await options.transport.call('capabilities.get', {})
        const merged = mergeClientCapabilities({ ...fallback, backendMode: options.mode }, patch)
        // 后端模式由本次启动的本地配置决定（避免会话中切换传输），其余字段以服务端为准。
        current = { ...merged, backendMode: options.mode }
        storage.set(CAPABILITIES_STORAGE_KEY, current)
      } catch {
        // 能力拉取失败保持既有能力，不阻塞业务。
      }
      return current
    },
  }
}
