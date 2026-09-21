import * as Crypto from 'expo-crypto'
import { File } from 'expo-file-system'
import * as ImagePicker from 'expo-image-picker'
import type { AssetPutFileRequest } from '@studycommit/common/paper-react'
import type { AssetMimeType } from '@studycommit/common/ports'

/** 与上传契约一致的体积上限;超限图片直接拒绝,提示用户更换。 */
export const MOBILE_ASSET_MAX_SIZE_BYTES = 10 * 1024 * 1024

export type PickedImage =
  | { status: 'picked'; localUri: string; mimeType: AssetMimeType; sizeBytes: number }
  | { status: 'cancelled' }
  | { status: 'denied' }
  | { status: 'tooLarge' }

/** 选择一张相册图片,读取类型与体积;未授权或取消时给出可提示的状态。 */
export async function pickLocalImage(): Promise<PickedImage> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permission.granted) {
    return { status: 'denied' }
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
    allowsMultipleSelection: false,
  })
  if (result.canceled) {
    return { status: 'cancelled' }
  }
  const asset = result.assets[0]
  if (!asset?.uri) {
    return { status: 'cancelled' }
  }
  const mimeType = normalizeMimeType(asset.mimeType)
  const sizeBytes = sizeOfLocalFile(asset.uri)
  if (sizeBytes > MOBILE_ASSET_MAX_SIZE_BYTES) {
    return { status: 'tooLarge' }
  }
  return { status: 'picked', localUri: asset.uri, mimeType, sizeBytes }
}

/** 平台仅支持 png/jpeg/webp 直传;其他格式按 jpeg 上报,由服务端魔数校验兜底。 */
export function normalizeMimeType(mimeType: string | null | undefined): AssetMimeType {
  if (mimeType === 'image/png' || mimeType === 'image/webp') {
    return mimeType
  }
  return 'image/jpeg'
}

export function sizeOfLocalFile(uri: string): number {
  const file = new File(uri)
  if (!file.exists) {
    throw new Error('图片不存在或已被清理')
  }
  return file.size
}

/** 内容指纹:同一文件得到相同摘要,供服务端会话去重与断点续传判定。 */
export async function sha256OfLocalFile(uri: string): Promise<string> {
  const file = new File(uri)
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, await file.arrayBuffer())
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** 用 XMLHttpRequest 直传本地文件到签名 PUT 地址(RN 的 fetch 不支持 { uri } 请求体)。 */
export async function putLocalFile(request: AssetPutFileRequest): Promise<void> {
  const file = new File(request.localUri)
  if (!file.exists) {
    throw new Error('图片不存在或已被清理')
  }
  const response = await file.upload(request.uploadUrl, {
    httpMethod: 'PUT',
    headers: {
      ...request.headers,
      ...(!request.headers['content-type'] ? { 'content-type': request.mimeType } : {}),
    },
  })
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`图片上传失败(HTTP ${response.status})`)
  }
}
