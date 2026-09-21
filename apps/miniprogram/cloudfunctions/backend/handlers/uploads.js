const { BackendError } = require('../errors')

// 前缀取自生产云环境真实文件 ID（cloud://环境.存储桶/），只能由服务端配置。
function cloudFileId(env, cloudPath) {
  const prefix = env.CLOUD_FILE_ID_PREFIX
  if (typeof prefix !== 'string' || !/^cloud:\/\/[^/]+\/$/.test(prefix)) {
    throw new BackendError('SERVICE_DISABLED', '云存储标识尚未配置')
  }
  return `${prefix}${cloudPath}`
}

const STAGED_COLLECTION = 'mp_staged_files'
const DEFAULT_MAX_IMAGE_BYTES = 10 * 1024 * 1024
const IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

function fileMaxBytes(env) {
  const parsed = Number.parseInt(env.FILE_MAX_BYTES, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_IMAGE_BYTES
}

function randomId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

function stagedCollection(db) {
  return db.collection(STAGED_COLLECTION)
}

/** 能力开关：服务端配置拥有最终决定权。 */
function createCapabilitiesOperations() {
  return {
    'capabilities.get': async ({ env }) => {
      const maxImages = Number.parseInt(env.MAX_CAPTURE_IMAGES, 10)
      return {
        backendMode: 'cloud-function',
        captureEnabled: env.CAPTURE_ENABLED === 'true',
        imageRecordEnabled: env.IMAGE_RECORD_ENABLED === 'true',
        ocrEnabled: env.OCR_ENABLED === 'true',
        maxCaptureImages: Number.isFinite(maxImages) && maxImages > 0 ? Math.min(maxImages, 9) : 9,
        maxImageBytes: fileMaxBytes(env),
      }
    },
  }
}

/**
 * 上传适配：
 * - stage/attach：图片先入私有云存储暂存位（登记归属 OPENID），
 *   attach 时云函数下载文件并复用现有预签名直传完成附件绑定，随后清理暂存；
 * - stageTemp/cleanupTemp：OCR 私有临时文件生命周期。
 */
function createUploadOperations() {
  return {
    'uploads.stage': async ({ payload, userContext, db, env }) => {
      const uploadId = payload ? payload.uploadId : undefined
      const mimeType = payload ? payload.mimeType : undefined
      const sizeBytes = payload ? payload.sizeBytes : undefined
      if (typeof uploadId !== 'string' || !uploadId || uploadId.length > 128) {
        throw new BackendError('INVALID_INPUT', '缺少 uploadId')
      }
      if (!IMAGE_MIME_TYPES.has(mimeType)) {
        throw new BackendError('INVALID_INPUT', '不支持的图片类型')
      }
      if (!Number.isInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > fileMaxBytes(env)) {
        throw new BackendError('PAYLOAD_TOO_LARGE', '图片超过大小限制')
      }
      const extension =
        mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'
      const cloudPath = `staging/${uploadId}.${extension}`
      const fileID = cloudFileId(env, cloudPath)
      // set 是 upsert：先查已有归属，防止知道 uploadId 的第三方覆盖他人登记。
      const existing = await readStaged(db, uploadId)
      if (existing && existing.owner !== userContext.openId) {
        throw new BackendError('FORBIDDEN', '上传标识已被占用')
      }
      await stagedCollection(db)
        .doc(uploadId)
        .set({
          data: {
            owner: userContext.openId,
            kind: 'asset',
            cloudPath,
            fileID,
            mimeType,
            sizeBytes,
            ...(payload.sha256 ? { sha256: payload.sha256 } : {}),
            updatedAt: db.serverDate(),
          },
        })
      return { cloudPath, fileID }
    },

    'uploads.attach': async ({ payload, userContext, db, cloud, forward, sendRaw }) => {
      const uploadId = payload ? payload.uploadId : undefined
      const fileID = payload ? payload.fileID : undefined
      if (typeof uploadId !== 'string' || !uploadId || typeof fileID !== 'string' || !fileID) {
        throw new BackendError('INVALID_INPUT', '缺少绑定参数')
      }
      const staged = await readStaged(db, uploadId)
      if (!staged || staged.owner !== userContext.openId || staged.kind !== 'asset') {
        throw new BackendError('FORBIDDEN', '无权绑定该文件')
      }
      if (!staged.fileID || fileID !== staged.fileID) {
        throw new BackendError('FORBIDDEN', '文件与登记不匹配')
      }
      const downloaded = await cloud.downloadFile({ fileID: staged.fileID })
      const bytes = downloaded && downloaded.fileContent
      if (!bytes || !bytes.length) {
        throw new BackendError('PROVIDER_FAILED', '暂存文件已失效')
      }
      const presign = await forward('POST', '/uploads', {
        uploadId,
        kind: 'image',
        mimeType: staged.mimeType,
        sizeBytes: bytes.length,
        ...(staged.sha256 ? { sha256: staged.sha256 } : {}),
      })
      await sendRaw({
        method: 'PUT',
        url: presign.uploadUrl,
        headers: presign.headers || {},
        body: bytes,
      })
      const completed = await forward('POST', `/uploads/${encodeURIComponent(uploadId)}/complete`)
      await cleanupStaged(db, cloud, uploadId, staged.fileID)
      return {
        uploadId,
        assetId: completed ? completed.assetId || completed.id : undefined,
        status: 'attached',
      }
    },

    'uploads.stageTemp': async ({ payload, userContext, db, env }) => {
      if (!payload || payload.kind !== 'ocr-temp') {
        throw new BackendError('INVALID_INPUT', '缺少暂存类型')
      }
      const tempId = randomId()
      const cloudPath = `ocr-temp/${tempId}`
      const fileID = cloudFileId(env, cloudPath)
      await stagedCollection(db)
        .doc(cloudPath)
        .set({
          data: {
            owner: userContext.openId,
            kind: 'ocr-temp',
            cloudPath,
            fileID,
            updatedAt: db.serverDate(),
          },
        })
      return { cloudPath, fileID }
    },

    'uploads.cleanupTemp': async ({ payload, userContext, db, cloud }) => {
      const fileRef = payload ? payload.fileRef : undefined
      if (typeof fileRef !== 'string' || !fileRef) {
        throw new BackendError('INVALID_INPUT', '缺少 fileRef')
      }
      const staged = await readStaged(db, fileRef)
      if (!staged || staged.owner !== userContext.openId) {
        // 归属不符时静默忽略，不暴露存在性。
        return { cleaned: false }
      }
      const cleaned = await cleanupStaged(db, cloud, fileRef, staged.fileID)
      return { cleaned }
    },
  }
}

async function readStaged(db, id) {
  try {
    const doc = await stagedCollection(db).doc(id).get()
    return doc && doc.data ? doc.data : null
  } catch (error) {
    if (error && typeof error.errMsg === 'string' && error.errMsg.includes('not exist')) {
      return null
    }
    throw new BackendError('PROVIDER_FAILED', '暂存记录读取失败')
  }
}

async function cleanupStaged(db, cloud, id, fileID) {
  // 先删文件，再删登记；删除失败保留登记供定时任务重试。
  try {
    if (fileID) {
      const result = await cloud.deleteFile({ fileList: [fileID] })
      if (result?.fileList?.some((file) => file.status !== 0)) {
        return false
      }
    }
    await stagedCollection(db).doc(id).remove()
    return true
  } catch {
    return false
  }
}

const STALE_STAGED_MS = 24 * 60 * 60 * 1000

/** 微信云函数定时触发器事件识别。 */
function isTimerEvent(event) {
  return Boolean(event && (event.Type === 'Timer' || event.triggerName))
}

/** 清理超过时限的暂存登记与对应云存储文件（attach/OCR 失败路径的残留兜底）。 */
async function cleanupStaleStaged(db, cloud, now = Date.now) {
  const cutoff = new Date(now() - STALE_STAGED_MS)
  const matched = await stagedCollection(db)
    .where({ updatedAt: db.command.lt(cutoff) })
    .limit(50)
    .get()
  const stale = (matched && matched.data) || []
  let cleaned = 0
  for (const item of stale) {
    const id = item && item._id
    if (!id) {
      continue
    }
    if (await cleanupStaged(db, cloud, id, item.fileID)) {
      cleaned += 1
    }
  }
  return { cleaned }
}

module.exports = {
  createCapabilitiesOperations,
  createUploadOperations,
  cleanupStaleStaged,
  isTimerEvent,
  STAGED_COLLECTION,
}
