import type { UploadsApi } from '@studycommit/common/ports'

/**
 * 资产访问地址缓存(MO-314 补充):uploads.access 换取的短时签名地址
 * 缓存到过期前 30 秒,避免同一资产反复换址。
 */

const EXPIRY_SAFETY_MS = 30_000

const cache = new Map<string, { url: string; expiresAt: number }>()

export function clearAssetUrlCache(): void {
  cache.clear()
}

export async function resolveAssetUrl(
  assetId: string,
  uploads: UploadsApi,
): Promise<string | null> {
  const hit = cache.get(assetId)
  if (hit && hit.expiresAt - EXPIRY_SAFETY_MS > Date.now()) {
    return hit.url
  }
  try {
    const access = await uploads.access(assetId)
    cache.set(assetId, {
      url: access.url,
      expiresAt: Number.isNaN(Date.parse(access.expiresAt))
        ? Date.now() + 60_000
        : Date.parse(access.expiresAt),
    })
    return access.url
  } catch {
    return null
  }
}
