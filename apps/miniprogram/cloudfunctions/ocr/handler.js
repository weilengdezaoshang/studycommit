const {
  fail,
  mergeOcrText,
  readCloudConfig,
  resolveCredential,
  resolveFailureCode,
  validateOcrInput,
  withTimeout,
} = require('./ocr-core')

/**
 * 每日配额用数据库条件更新原子占用：仅当 count < 限额时 +1，
 * 并发请求在数据库侧串行生效，不会绕过限额；达到限额后不再调用腾讯云。
 */
async function consumeDailyQuota(db, openid, day, dailyLimit) {
  const rates = db.collection('ocr_rate_limits')
  const rateId = `${openid}_${day}`
  const claim = () =>
    rates
      .where({ _id: rateId, count: db.command.lt(dailyLimit) })
      .update({ data: { count: db.command.inc(1), updatedAt: db.serverDate() } })
  if ((await claim()).stats.updated === 1) {
    return
  }
  try {
    // 当天首次调用：创建计数文档占用第 1 次；并发创建只有一次成功，其余走原子占用。
    await rates.add({
      data: { _id: rateId, owner: openid, day, count: 1, updatedAt: db.serverDate() },
    })
  } catch {
    if ((await claim()).stats.updated !== 1) {
      throw new Error('OCR_RATE_LIMITED')
    }
  }
}

/** 组装 OCR 云函数处理器；微信上下文、数据库、腾讯云客户端、环境与日志全部注入，便于测试。 */
function createOcrHandler(deps) {
  const { getWXContext, db, createOcrClient, env, log, downloadFile, deleteFile } = deps
  const now = deps.now || Date.now
  const config = readCloudConfig(env)

  return async function main(event) {
    const startedAt = now()
    const { OPENID } = getWXContext()
    if (!OPENID) {
      return fail('OCR_UNAUTHENTICATED')
    }
    if (!config.enabled) {
      return fail('OCR_DISABLED')
    }
    const input = validateOcrInput(event)
    if (input.code) {
      return fail(input.code)
    }
    const credential = resolveCredential(env)
    if (!credential) {
      return fail('OCR_NOT_CONFIGURED')
    }
    const { imageId, version } = input
    const day = new Date(now()).toISOString().slice(0, 10)
    let ownedResource
    try {
      await consumeDailyQuota(db, OPENID, day, config.dailyLimit)
      const imageBase64 = await resolveImageBytes(db, OPENID, input, downloadFile, (resource) => {
        ownedResource = resource
      })
      // SDK 自身超时比协议超时多 1 秒，保证超时统一由处理器判定为 OCR_TIMEOUT。
      const client = createOcrClient(
        credential,
        config.region,
        Math.ceil(config.timeoutMs / 1000) + 1,
      )
      const response = await withTimeout(
        client.GeneralAccurateOCR({ ImageBase64: imageBase64 }),
        config.timeoutMs,
      )
      const text = mergeOcrText(response)
      // 日志只允许 imageId、version、耗时和错误码。
      log.info(
        JSON.stringify({ event: 'ocr_complete', imageId, version, durationMs: now() - startedAt }),
      )
      return { ok: true, imageId, version, text }
    } catch (error) {
      const code = resolveFailureCode(error)
      log.error(
        JSON.stringify({
          event: 'ocr_failed',
          imageId,
          version,
          durationMs: now() - startedAt,
          code,
        }),
      )
      return fail(code)
    } finally {
      if (ownedResource) {
        await cleanupTempFile(db, deleteFile, ownedResource)
      }
    }
  }
}

const STAGED_COLLECTION = 'mp_staged_files'

/** 识别图片来源：私有临时文件需归属校验；内联 Base64 直接透传。 */
async function resolveImageBytes(db, openid, input, downloadFile, onOwned) {
  if (!input.fileRef) {
    return input.imageBase64
  }
  let staged
  try {
    const doc = await db.collection(STAGED_COLLECTION).doc(input.fileRef).get()
    staged = doc && doc.data ? doc.data : null
  } catch {
    staged = null
  }
  if (!staged || staged.owner !== openid || staged.kind !== 'ocr-temp') {
    // 归属不符或文件不存在一律拒绝，不暴露存在性。
    throw new Error('OCR_FORBIDDEN')
  }
  if (typeof staged.fileID !== 'string' || !staged.fileID.startsWith('cloud://')) {
    throw new Error('OCR_FORBIDDEN')
  }
  onOwned({ fileRef: input.fileRef, fileID: staged.fileID })
  const downloaded = await downloadFile({ fileID: staged.fileID })
  const buffer = downloaded && downloaded.fileContent
  if (!buffer || !buffer.length) {
    throw new Error('OCR_FORBIDDEN')
  }
  const imageBase64 = Buffer.from(buffer).toString('base64')
  if (imageBase64.length > 4 * 1024 * 1024) {
    throw new Error('OCR_IMAGE_TOO_LARGE')
  }
  return imageBase64
}

/** 识别结束后删除临时识别资源（文件与登记文档），失败不影响主流程。 */
async function cleanupTempFile(db, deleteFile, { fileRef, fileID }) {
  try {
    if (typeof deleteFile !== 'function') {
      return
    }
    const result = await deleteFile({ fileList: [fileID] })
    if (result?.fileList?.some((file) => file.status !== 0)) {
      return
    }
    await db.collection(STAGED_COLLECTION).doc(fileRef).remove()
  } catch {
    // 保留登记供定时任务重试。
  }
}

module.exports = { createOcrHandler, consumeDailyQuota }
