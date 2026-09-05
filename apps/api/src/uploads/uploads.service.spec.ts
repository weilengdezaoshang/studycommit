import { deflateSync } from 'node:zlib'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConfigService } from '@nestjs/config'
import type { AppEnv } from '../config/env'
import { buildStorageKey, UploadsService } from './uploads.service'
import { MemoryStorageGateway, detectImageMime, StorageGatewayProvider } from './storage.gateway'
import type { PaperAsset, UploadsRepository } from './uploads.repository'

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buffer: Buffer): number {
  let value = 0xffffffff
  for (const byte of buffer) {
    value = CRC_TABLE[(value ^ byte) & 0xff]! ^ (value >>> 8)
  }
  return (value ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const typeBuffer = Buffer.from(type, 'latin1')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])))
  return Buffer.concat([length, typeBuffer, data, crc])
}

/** 构造确定性的合法 PNG:1x1 像素,RGB。 */
function createPng(width: number, height: number): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const raw = Buffer.alloc(height * (1 + width * 3))
  return Buffer.concat([
    Buffer.from(PNG_SIGNATURE),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

const USER = '11111111-1111-4111-8111-111111111111'
const UPLOAD_ID = '22222222-2222-4222-8222-222222222222'

function createService() {
  const repository = {
    findByUploadId: vi.fn<UploadsRepository['findByUploadId']>(async () => null),
    findById: vi.fn<UploadsRepository['findById']>(async () => null),
    createSession: vi.fn<UploadsRepository['createSession']>(async (_userId, input, storage) => ({
      id: '33333333-3333-4333-8333-333333333333',
      userId: USER,
      uploadId: input.uploadId,
      paperId: null,
      kind: 'image',
      status: 'pending',
      storageKey: storage.storageKey,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      width: null,
      height: null,
      sha256: input.sha256,
      ocrText: null,
      expiresAt: storage.expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    })),
    markUploaded: vi.fn<UploadsRepository['markUploaded']>(async (_assetId, dimensions) => ({
      id: '33333333-3333-4333-8333-333333333333',
      userId: USER,
      uploadId: UPLOAD_ID,
      paperId: null,
      kind: 'image',
      status: 'uploaded',
      storageKey: `u/${USER}/202609/${UPLOAD_ID}.png`,
      mimeType: 'image/png',
      sizeBytes: 100,
      width: dimensions.width,
      height: dimensions.height,
      sha256: 'a'.repeat(64),
      ocrText: null,
      expiresAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    })),
    markDeleted: vi.fn<UploadsRepository['markDeleted']>(async () => undefined),
    listExpiredPending: vi.fn<UploadsRepository['listExpiredPending']>(async () => []),
    attachToPaper: vi.fn<UploadsRepository['attachToPaper']>(async () => undefined),
  }
  const gateway = new MemoryStorageGateway('test-assets')
  const provider = new StorageGatewayProvider({} as ConfigService<AppEnv>, gateway as never)
  const service = new UploadsService(repository as unknown as UploadsRepository, provider)
  return { service, repository, gateway }
}

const baseInput = {
  uploadId: UPLOAD_ID,
  kind: 'image' as const,
  mimeType: 'image/png' as const,
  sizeBytes: 100,
  sha256: 'a'.repeat(64),
}

describe('uploads 服务', () => {
  let context: ReturnType<typeof createService>

  beforeEach(() => {
    context = createService()
  })

  it('对象键按用户、月份与上传 ID 组织', () => {
    const key = buildStorageKey(USER, UPLOAD_ID, 'image/png', new Date('2026-09-05T00:00:00Z'))
    expect(key).toBe(`u/${USER}/202609/${UPLOAD_ID}.png`)
  })

  it('识别 png/jpeg/webp 魔数并拒绝其他内容', () => {
    expect(detectImageMime(Buffer.from(PNG_SIGNATURE))).toBe('image/png')
    expect(detectImageMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
    const webp = Buffer.concat([
      Buffer.from('RIFF', 'latin1'),
      Buffer.alloc(4),
      Buffer.from('WEBP', 'latin1'),
    ])
    expect(detectImageMime(webp)).toBe('image/webp')
    expect(detectImageMime(Buffer.from('not an image'))).toBeNull()
  })

  it('创建会话返回签名直传地址', async () => {
    const output = await context.service.createUpload(USER, baseInput)

    expect(output.status).toBe('pending')
    expect(output.uploadId).toBe(UPLOAD_ID)
    expect(output.headers).toEqual({ 'content-type': 'image/png' })
    expect(new URL(output.uploadUrl).pathname).toContain(UPLOAD_ID)
  })

  it('相同参数重试复用既有会话，不同参数冲突', async () => {
    context.repository.findByUploadId.mockResolvedValue({
      id: '33333333-3333-4333-8333-333333333333',
      userId: USER,
      uploadId: UPLOAD_ID,
      paperId: null,
      kind: 'image',
      status: 'pending',
      storageKey: `u/${USER}/202609/${UPLOAD_ID}.png`,
      mimeType: 'image/png',
      sizeBytes: 100,
      width: null,
      height: null,
      sha256: 'a'.repeat(64),
      ocrText: null,
      expiresAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    })

    const replayed = await context.service.createUpload(USER, baseInput)
    expect(replayed.uploadId).toBe(UPLOAD_ID)

    await expect(
      context.service.createUpload(USER, { ...baseInput, sha256: 'b'.repeat(64) }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'UPLOAD_CONFLICT' }) })
  })

  it('完成上传校验大小与魔数并记录尺寸', async () => {
    const png = createPng(2, 3)
    const row: PaperAsset = {
      id: '33333333-3333-4333-8333-333333333333',
      userId: USER,
      uploadId: UPLOAD_ID,
      paperId: null,
      kind: 'image',
      status: 'pending',
      storageKey: `u/${USER}/202609/${UPLOAD_ID}.png`,
      mimeType: 'image/png',
      sizeBytes: png.length,
      width: null,
      height: null,
      sha256: 'a'.repeat(64),
      ocrText: null,
      expiresAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    }
    context.repository.findByUploadId.mockResolvedValue(row)
    const signed = await context.gateway.presignPut(row.storageKey, 'image/png', 900)
    context.gateway.fulfillUpload(signed.url, png)

    const output = await context.service.completeUpload(USER, UPLOAD_ID)

    expect(output.status).toBe('uploaded')
    expect(output.width).toBe(2)
    expect(output.height).toBe(3)
    expect(context.repository.markUploaded).toHaveBeenCalledWith(
      row.id,
      expect.objectContaining({ width: 2, height: 3 }),
    )
  })

  it('对象缺失时拒绝完成并允许重传', async () => {
    context.repository.findByUploadId.mockResolvedValue({
      id: '33333333-3333-4333-8333-333333333333',
      userId: USER,
      uploadId: UPLOAD_ID,
      paperId: null,
      kind: 'image',
      status: 'pending',
      storageKey: `u/${USER}/202609/${UPLOAD_ID}.png`,
      mimeType: 'image/png',
      sizeBytes: 100,
      width: null,
      height: null,
      sha256: 'a'.repeat(64),
      ocrText: null,
      expiresAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    })

    await expect(context.service.completeUpload(USER, UPLOAD_ID)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'UPLOAD_OBJECT_MISSING' }),
    })
  })

  it('过期清理只回收对象存在映射的 pending 会话', async () => {
    const expired = [
      {
        id: '33333333-3333-4333-8333-333333333333',
        storageKey: `u/${USER}/202608/old.png`,
      },
    ]
    context.repository.listExpiredPending.mockResolvedValue(expired as never)

    const cleaned = await context.service.cleanupExpired(new Date())

    expect(cleaned).toBe(1)
    expect(context.repository.markDeleted).toHaveBeenCalledWith(expired[0]!.id)
  })
})
