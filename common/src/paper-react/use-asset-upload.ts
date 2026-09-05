import { useCallback, useRef, useState } from 'react'
import type { AssetKind, AssetMimeType, UploadsApi } from '../ports'

/**
 * 图片直传 Hook(SH-305):create → PUT 签名地址 → complete 三步编排。
 * 平台差异(读文件、哈希、PUT 本地文件)通过 putFile/sha256/createUploadId 注入;
 * 同一本地文件重试复用同一 uploadId,服务端按幂等去重,不留重复会话。
 */

export const ASSET_UPLOAD_ERROR = '图片上传失败，请重试'

export interface AssetPutFileRequest {
  uploadUrl: string
  headers: Record<string, string>
  /** 平台本地文件引用(移动端本地 URI、桌面端临时路径) */
  localUri: string
  mimeType: string
}

export interface AssetUploadFileInput {
  localUri: string
  kind: AssetKind
  mimeType: AssetMimeType
  sizeBytes: number
}

export interface AssetUploadItem {
  uploadId: string
  localUri: string
}

export interface UseAssetUploadOptions {
  uploads: UploadsApi
  putFile: (request: AssetPutFileRequest) => Promise<void>
  /** 计算文件 SHA-256(小写 hex),由平台实现 */
  sha256: (localUri: string) => Promise<string>
  createUploadId: () => string
  now?: () => number
}

export interface AssetUploadController {
  /** 已完成直传的图片列表(可展示、可删除) */
  items: AssetUploadItem[]
  uploading: boolean
  uploadError: string | null
  /** 上传一张图片;成功返回 uploadId,失败返回 null(草稿内容不受影响) */
  uploadFile: (input: AssetUploadFileInput) => Promise<string | null>
  /** 取消上传:删除对象与记录,并从列表移除 */
  cancelUpload: (uploadId: string) => Promise<void>
}

interface AttemptedUpload {
  uploadId: string
  expiresAt: number
}

export function useAssetUpload({
  uploads,
  putFile,
  sha256,
  createUploadId,
  now = () => Date.now(),
}: UseAssetUploadOptions): AssetUploadController {
  const [items, setItems] = useState<AssetUploadItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const attemptedRef = useRef(new Map<string, AttemptedUpload>())
  const uploadingRef = useRef(false)

  const uploadFile = useCallback(
    async (input: AssetUploadFileInput): Promise<string | null> => {
      if (uploadingRef.current) {
        return null
      }
      uploadingRef.current = true
      setUploading(true)
      setUploadError(null)
      try {
        const digest = await sha256(input.localUri)
        const existing = attemptedRef.current.get(input.localUri)
        const reuse = existing && existing.expiresAt > now() ? existing : null
        const uploadId = reuse?.uploadId ?? createUploadId()
        const session = await uploads.create({
          uploadId,
          kind: input.kind,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          sha256: digest,
        })
        attemptedRef.current.set(input.localUri, {
          uploadId: session.uploadId,
          expiresAt: Date.parse(session.expiresAt),
        })
        await putFile({
          uploadUrl: session.uploadUrl,
          headers: session.headers,
          localUri: input.localUri,
          mimeType: input.mimeType,
        })
        await uploads.complete(session.uploadId)
        setItems((previous) =>
          previous.some((item) => item.uploadId === session.uploadId)
            ? previous
            : [...previous, { uploadId: session.uploadId, localUri: input.localUri }],
        )
        return session.uploadId
      } catch {
        setUploadError(ASSET_UPLOAD_ERROR)
        return null
      } finally {
        uploadingRef.current = false
        setUploading(false)
      }
    },
    [uploads, putFile, sha256, createUploadId, now],
  )

  const cancelUpload = useCallback(
    async (uploadId: string): Promise<void> => {
      try {
        await uploads.remove(uploadId)
      } finally {
        setItems((previous) => previous.filter((item) => item.uploadId !== uploadId))
        for (const [localUri, attempted] of attemptedRef.current) {
          if (attempted.uploadId === uploadId) {
            attemptedRef.current.delete(localUri)
          }
        }
      }
    },
    [uploads],
  )

  return { items, uploading, uploadError, uploadFile, cancelUpload }
}
