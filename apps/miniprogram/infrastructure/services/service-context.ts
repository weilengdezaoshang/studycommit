import type { MiniprogramBackendMode } from '../../shared/service-runtime/index'
import {
  createMiniprogramServices,
  type CreateMiniprogramServicesOptions,
  type MiniprogramServices,
} from './create-miniprogram-services'

/**
 * 小程序服务组合入口（单例）：
 * 页面统一通过 getMiniprogramServices() 获取业务服务，
 * 不感知传输方式；测试通过 configureMiniprogramServices 注入。
 */

/** 本地配置的后端模式（envVersion 默认值 + 本地调试覆盖，最终以服务端能力为准）。 */
const BACKEND_MODE_STORAGE_KEY = 'studycommit.backend.mode.v1'
const BACKEND_MODES: Record<string, MiniprogramBackendMode> = {
  develop: 'cloud-function',
  trial: 'cloud-function',
  release: 'http',
}

export function resolveLocalBackendMode(): MiniprogramBackendMode {
  const envVersion = wx.getAccountInfoSync().miniProgram.envVersion
  const fallback = BACKEND_MODES[envVersion] ?? 'http'
  try {
    const override = wx.getStorageSync(BACKEND_MODE_STORAGE_KEY)
    if (override === 'cloud-function' || override === 'http') {
      return override
    }
  } catch {
    // 本地覆盖读取失败按默认值。
  }
  return fallback
}

export function setLocalBackendMode(mode: MiniprogramBackendMode | null): void {
  try {
    if (mode) {
      wx.setStorageSync(BACKEND_MODE_STORAGE_KEY, mode)
    } else {
      wx.removeStorageSync(BACKEND_MODE_STORAGE_KEY)
    }
  } catch {
    // 忽略本地存储异常。
  }
}

let cached: MiniprogramServices | null = null

export function configureMiniprogramServices(
  options?: Partial<CreateMiniprogramServicesOptions> & { mode?: MiniprogramBackendMode },
): MiniprogramServices {
  cached = createMiniprogramServices({
    mode: options?.mode ?? resolveLocalBackendMode(),
    allowHttpFallback: options?.allowHttpFallback ?? true,
    ...options,
  })
  return cached
}

export function getMiniprogramServices(): MiniprogramServices {
  cached ??= configureMiniprogramServices()
  return cached
}

/** 应用启动时调用：刷新能力开关（服务端最终决定权），失败不阻塞。 */
export async function ensureMiniprogramServicesReady(): Promise<void> {
  const services = getMiniprogramServices()
  await services.capabilities.refresh().catch(() => undefined)
}
