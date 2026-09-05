import { ASSET_MAX_SIZE_BYTES } from '@studycommit/rpc-contracts/uploads'

export const STORAGE_GATEWAY = Symbol('STORAGE_GATEWAY')

export const UPLOAD_ERROR = {
  unavailable: {
    code: 'UPLOAD_STORAGE_UNAVAILABLE',
    message: '对象存储未配置，上传功能暂不可用',
  },
  notFound: { code: 'UPLOAD_NOT_FOUND', message: '上传会话不存在' },
  conflict: { code: 'UPLOAD_CONFLICT', message: '上传会话参数与已存在记录不一致' },
  objectMissing: { code: 'UPLOAD_OBJECT_MISSING', message: '对象尚未上传或已失效，请重新直传' },
  sizeMismatch: { code: 'UPLOAD_SIZE_MISMATCH', message: '对象大小与声明不一致' },
  mimeMismatch: { code: 'UPLOAD_MIME_MISMATCH', message: '对象内容与声明的图片类型不一致' },
  unreadable: { code: 'UPLOAD_UNREADABLE', message: '对象不是可解析的图片' },
  notCancellable: { code: 'UPLOAD_NOT_CANCELLABLE', message: '已绑定的资产不能取消上传会话' },
  notAvailable: { code: 'UPLOAD_NOT_AVAILABLE', message: '资产不存在或尚未完成上传' },
} as const

/** 直传签名 PUT 有效期 */
export const UPLOAD_PUT_TTL_SECONDS = 15 * 60
/** 私有访问签名 GET 有效期(PRD:短时地址,客户端缓存到 expiresAt 前) */
export const UPLOAD_ACCESS_TTL_SECONDS = 300
/** 未完成直传的会话保留时长,过期后由清理任务回收 */
export const UPLOAD_SESSION_TTL_MS = 24 * 60 * 60 * 1000
/** complete 时 Range GET 读取的头部字节数:足够魔数校验与 image-size 解析尺寸 */
export const ASSET_READ_HEAD_BYTES = 64 * 1024

export const ASSET_LIMITS = { maxSizeBytes: ASSET_MAX_SIZE_BYTES } as const
