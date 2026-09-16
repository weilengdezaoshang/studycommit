import {
  assetAccessOutputSchema,
  completeUploadOutputSchema,
  createUploadOutputSchema,
  type AssetMimeType,
} from '@studycommit/rpc-contracts/uploads'
import { ServiceError } from '../../shared/service-runtime/index'
import { sha256 } from '../../services/sha256'
import type { MiniprogramTransport } from '../transport/transport.types'

export type MiniprogramUploadInput = {
  path: string
  uploadId: string
  mimeType: AssetMimeType
}

/** 统一上传结果：三种状态覆盖预签名直传与云存储两条链路。 */
export type UploadOutcome = {
  uploadId: string
  assetId?: string
  status: 'pending' | 'uploaded' | 'attached'
}

export type BackendMode = 'cloud-function' | 'http'

export interface UploadsService {
  accessAsset(assetId: string): Promise<string>
  upload(input: MiniprogramUploadInput): Promise<UploadOutcome>
}

export interface CreateUploadsServiceOptions {
  transport: MiniprogramTransport
  mode: BackendMode
  getMaxImageBytes?: () => number
  /** 平台能力注入（测试用）。 */
  readFileBytes?: (path: string) => Promise<ArrayBuffer>
  putToUrl?: (url: string, headers: Record<string, string>, data: ArrayBuffer) => Promise<void>
  uploadCloudFile?: (cloudPath: string, filePath: string) => Promise<string>
}

function readFileDefault(path: string): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath: path,
      success: (result) => resolve(result.data as ArrayBuffer),
      fail: reject,
    })
  })
}

function putDefault(
  url: string,
  headers: Record<string, string>,
  data: ArrayBuffer,
): Promise<void> {
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: 'PUT',
      header: headers,
      data,
      success: (response) =>
        response.statusCode >= 200 && response.statusCode < 300
          ? resolve()
          : reject(
              new ServiceError({
                code: 'PROVIDER_FAILED',
                message: `直传失败（HTTP ${response.statusCode}）`,
                retryable: true,
              }),
            ),
      fail: reject,
    })
  })
}

function uploadCloudFileDefault(cloudPath: string, filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    wx.cloud.uploadFile({
      cloudPath,
      filePath,
      success: (result) => resolve(result.fileID),
      fail: reject,
    })
  })
}

/**
 * 统一上传服务：
 * - http 模式：预签名直传（POST /uploads → PUT → complete）。
 * - cloud-function 模式：图片先入私有云存储暂存位，backend 云函数校验归属后
 *   下载并复用现有预签名直传完成附件绑定，避免客户端重复提交大文件。
 */
export function createUploadsService(options: CreateUploadsServiceOptions): UploadsService {
  const { transport, mode } = options
  const readFileBytes = options.readFileBytes ?? readFileDefault
  const putToUrl = options.putToUrl ?? putDefault
  const uploadCloudFile = options.uploadCloudFile ?? uploadCloudFileDefault

  return {
    async accessAsset(assetId: string): Promise<string> {
      const result = await transport
        .call('uploads.access', { assetId })
        .then((value) => assetAccessOutputSchema.parse(value))
      return result.url
    },

    async upload(input: MiniprogramUploadInput): Promise<UploadOutcome> {
      const bytes = await readFileBytes(input.path)
      const digest = sha256(bytes)
      const maxBytes = options.getMaxImageBytes?.() ?? Number.MAX_SAFE_INTEGER
      if (bytes.byteLength > maxBytes) {
        throw new ServiceError({
          code: 'PAYLOAD_TOO_LARGE',
          message: '图片超过大小限制',
          retryable: false,
        })
      }
      const shared = {
        uploadId: input.uploadId,
        kind: 'image' as const,
        mimeType: input.mimeType,
        sizeBytes: bytes.byteLength,
        sha256: digest,
      }
      if (mode === 'http') {
        const session = await transport
          .call('uploads.create', shared)
          .then((value) => createUploadOutputSchema.parse(value))
        await putToUrl(session.uploadUrl, session.headers, bytes)
        await transport
          .call('uploads.complete', { uploadId: input.uploadId })
          .then((value) => completeUploadOutputSchema.parse(value))
        return { uploadId: input.uploadId, status: 'uploaded' }
      }
      const staged = await transport.call<typeof shared, { cloudPath: string }>(
        'uploads.stage',
        shared,
      )
      if (!staged || typeof staged.cloudPath !== 'string' || !staged.cloudPath) {
        throw new ServiceError({
          code: 'PROVIDER_FAILED',
          message: '云存储暂存响应非法',
          retryable: false,
        })
      }
      const fileID = await uploadCloudFile(staged.cloudPath, input.path)
      const attached = await transport.call<
        { uploadId: string; fileID: string },
        { uploadId?: string; assetId?: string; status?: string }
      >('uploads.attach', { uploadId: input.uploadId, fileID })
      if (attached?.status !== 'attached') {
        throw new ServiceError({
          code: 'PROVIDER_FAILED',
          message: '附件绑定未完成',
          retryable: true,
        })
      }
      return {
        uploadId: input.uploadId,
        ...(attached.assetId ? { assetId: attached.assetId } : {}),
        status: 'attached',
      }
    },
  }
}
