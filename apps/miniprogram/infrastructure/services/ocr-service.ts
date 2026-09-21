import { ServiceError, type ServiceErrorCode } from '../../shared/service-runtime/index'
import type { MiniprogramTransport } from '../transport/transport.types'
import type { BackendMode } from './uploads-service'

export interface OcrRecognizeInput {
  imageId: string
  version: number
  /** 私有云存储临时文件路径（cloudPath）；云函数模式使用。 */
  fileRef?: string
  /** 本地图片路径：云函数模式下先暂存到私有云存储再识别。 */
  localPath?: string
}

export interface OcrService {
  recognize(input: OcrRecognizeInput): Promise<{
    imageId: string
    version: number
    text: string
  }>
}

/** OCR 云函数保留独立协议，由此适配器统一翻译为 ServiceError。 */
export const OCR_CLOUD_FUNCTION_NAME = 'ocr'

const OCR_CODE_TO_SERVICE_CODE: Record<string, ServiceErrorCode> = {
  OCR_UNAUTHENTICATED: 'UNAUTHENTICATED',
  OCR_DISABLED: 'SERVICE_DISABLED',
  OCR_NOT_CONFIGURED: 'SERVICE_DISABLED',
  OCR_INVALID_INPUT: 'INVALID_INPUT',
  OCR_IMAGE_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  OCR_RATE_LIMITED: 'RATE_LIMITED',
  OCR_FORBIDDEN: 'FORBIDDEN',
  OCR_TIMEOUT: 'TIMEOUT',
  OCR_PROVIDER_FAILED: 'PROVIDER_FAILED',
}

export interface CreateOcrServiceOptions {
  mode: BackendMode
  /** 统一传输：用于识别前的私有临时文件登记。 */
  transport: MiniprogramTransport
  callFunction?: (options: { name: string; data: unknown }) => Promise<{ result?: unknown }>
  uploadCloudFile?: (cloudPath: string, filePath: string) => Promise<string>
  cloudAvailable?: () => boolean
}

function toOcrServiceError(code: string): ServiceError {
  const mapped = OCR_CODE_TO_SERVICE_CODE[code]
  return new ServiceError({
    code: mapped ?? 'PROVIDER_FAILED',
    message: '识别失败',
    retryable: mapped === 'TIMEOUT' || mapped === 'PROVIDER_FAILED',
  })
}

export function createOcrService(options: CreateOcrServiceOptions): OcrService {
  const callFunction =
    options.callFunction ??
    ((request: { name: string; data: unknown }) =>
      wx.cloud.callFunction(request as never) as unknown as Promise<{ result?: unknown }>)
  const uploadCloudFile =
    options.uploadCloudFile ??
    ((cloudPath: string, filePath: string) =>
      new Promise<string>((resolve, reject) => {
        wx.cloud.uploadFile({
          cloudPath,
          filePath,
          success: (result) => resolve(result.fileID),
          fail: reject,
        })
      }))
  const cloudAvailable =
    options.cloudAvailable ?? (() => typeof wx !== 'undefined' && Boolean(wx?.cloud))

  return {
    async recognize(input: OcrRecognizeInput) {
      if (options.mode !== 'cloud-function') {
        throw new ServiceError({
          code: 'SERVICE_DISABLED',
          message: '当前模式未开通图片识别',
          retryable: false,
        })
      }
      if (!cloudAvailable()) {
        throw new ServiceError({
          code: 'SERVICE_DISABLED',
          message: '当前小程序未开通云能力',
          retryable: false,
        })
      }
      let fileRef: string | undefined = input.fileRef
      let stagedTemp = false
      if (!fileRef) {
        if (!input.localPath) {
          throw new ServiceError({
            code: 'INVALID_INPUT',
            message: '缺少识别图片',
            retryable: false,
          })
        }
        const staged = await options.transport.call<
          { kind: string },
          { cloudPath?: string; fileID?: string }
        >('uploads.stageTemp', { kind: 'ocr-temp' })
        const cloudPath = staged?.cloudPath
        if (!cloudPath) {
          throw new ServiceError({
            code: 'PROVIDER_FAILED',
            message: '识别暂存失败',
            retryable: true,
          })
        }
        fileRef = cloudPath
        stagedTemp = true
        try {
          const fileID = await uploadCloudFile(cloudPath, input.localPath)
          if (staged.fileID && staged.fileID !== fileID) {
            throw new ServiceError({
              code: 'PROVIDER_FAILED',
              message: '云存储环境不匹配',
              retryable: false,
            })
          }
        } catch (error) {
          await options.transport.call('uploads.cleanupTemp', { fileRef }).catch(() => undefined)
          throw error
        }
      }
      const resolvedFileRef = fileRef
      try {
        return await recognizeByCloudFunction(input.imageId, input.version, resolvedFileRef)
      } catch (error) {
        if (stagedTemp) {
          await options.transport
            .call('uploads.cleanupTemp', { fileRef: resolvedFileRef })
            .catch(() => undefined)
        }
        throw error
      }
    },
  }

  async function recognizeByCloudFunction(
    imageId: string,
    version: number,
    fileRef: string,
  ): Promise<{ imageId: string; version: number; text: string }> {
    let response: { result?: unknown }
    try {
      response = await callFunction({
        name: OCR_CLOUD_FUNCTION_NAME,
        data: { imageId, version, fileRef },
      })
    } catch {
      throw new ServiceError({
        code: 'PROVIDER_FAILED',
        message: '识别服务调用失败',
        retryable: true,
      })
    }
    const result = response?.result as { ok?: boolean; text?: string; code?: string } | undefined
    if (!result?.ok) {
      throw toOcrServiceError(result?.code ?? 'OCR_PROVIDER_FAILED')
    }
    return { imageId, version, text: result.text?.trim() ?? '' }
  }
}
