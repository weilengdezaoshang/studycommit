import { deflateSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { drizzle } from 'drizzle-orm/node-postgres'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { applyTestEnv, testEnv } from '../helpers/env'
import { MemoryStorageGateway, StorageGatewayProvider } from '../../src/uploads/storage.gateway'

const USER_A = '11111111-1111-4111-8111-111111111111'
const USER_B = '22222222-2222-4222-8222-222222222222'
const UPLOAD_ID = '33333333-3333-4333-8333-333333333333'

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

function createPng(width: number, height: number): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const raw = Buffer.alloc(height * (1 + width * 3))
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

const sha256 = (data: Buffer) => createHash('sha256').update(data).digest('hex')

describe('Uploads API', () => {
  let app: NestFastifyApplication
  let storage: MemoryStorageGateway
  const pool = new Pool({ connectionString: testEnv.DATABASE_URL })
  const png = createPng(2, 3)

  beforeAll(async () => {
    applyTestEnv()
    await migrate(drizzle(pool), { migrationsFolder: './drizzle' })
    const module = await import('../../src/app.factory.js')
    app = await module.createApp()
    storage = app.get(StorageGatewayProvider).gateway as MemoryStorageGateway
  })

  beforeEach(async () => {
    await pool.query('truncate paper_assets, papers, idempotency_records')
    storage.clear()
  })

  afterAll(async () => {
    await app.close()
    await pool.end()
  })

  const createUpload = (userId = USER_A, uploadId = UPLOAD_ID, body: object = {}) =>
    app.inject({
      method: 'POST',
      url: '/api/uploads',
      headers: { 'x-user-id': userId },
      payload: {
        uploadId,
        kind: 'image',
        mimeType: 'image/png',
        sizeBytes: png.length,
        sha256: sha256(png),
        ...body,
      },
    })

  const complete = (uploadId = UPLOAD_ID, userId = USER_A) =>
    app.inject({
      method: 'POST',
      url: `/api/uploads/${uploadId}/complete`,
      headers: { 'x-user-id': userId },
    })

  async function fulfillAndComplete(userId = USER_A, uploadId = UPLOAD_ID, data: Buffer = png) {
    const created = (await createUpload(userId, uploadId)).json()
    storage.fulfillUpload(created.uploadUrl, data)
    const completed = await complete(uploadId, userId)
    return { created, completed }
  }

  it('创建会话返回待上传状态与直传地址，重复创建复用同一会话', async () => {
    const first = await createUpload()
    expect(first.statusCode).toBe(201)
    expect(first.json()).toMatchObject({
      uploadId: UPLOAD_ID,
      kind: 'image',
      status: 'pending',
      headers: { 'content-type': 'image/png' },
    })
    expect(new URL(first.json().uploadUrl).pathname).toContain(UPLOAD_ID)

    const replay = await createUpload()
    expect(replay.json().assetId).toBe(first.json().assetId)

    const conflict = await createUpload(USER_A, UPLOAD_ID, {
      sha256: sha256(Buffer.from('其他内容')),
    })
    expect(conflict.statusCode).toBe(409)
  })

  it('拒绝不支持的类型与超限大小', async () => {
    const badMime = await createUpload(USER_A, UPLOAD_ID, { mimeType: 'image/gif' })
    expect(badMime.statusCode).toBe(400)

    const tooLarge = await createUpload(USER_A, UPLOAD_ID, { sizeBytes: 11 * 1024 * 1024 })
    expect(tooLarge.statusCode).toBe(400)
  })

  it('完成上传核对大小与魔数并记录尺寸', async () => {
    const { completed } = await fulfillAndComplete()
    expect(completed.statusCode).toBe(200)
    expect(completed.json()).toMatchObject({
      uploadId: UPLOAD_ID,
      status: 'uploaded',
      width: 2,
      height: 3,
    })

    // 完成是幂等的:再次 complete 返回同样结果
    const again = await complete()
    expect(again.statusCode).toBe(200)
  })

  it('对象尚未直传时拒绝完成并允许重传', async () => {
    await createUpload()
    const missing = await complete()
    expect(missing.statusCode).toBe(409)
    expect(missing.json().code).toBe('UPLOAD_OBJECT_MISSING')

    // 重传后可完成
    const created = (await createUpload()).json()
    storage.fulfillUpload(created.uploadUrl, png)
    expect((await complete()).statusCode).toBe(200)
  })

  it('对象大小或内容与声明不符时拒绝完成', async () => {
    const created = (await createUpload()).json()
    storage.fulfillUpload(created.uploadUrl, Buffer.concat([png, Buffer.from('尾部多余字节')]))
    const sizeMismatch = await complete()
    expect(sizeMismatch.statusCode).toBe(409)
    expect(sizeMismatch.json().code).toBe('UPLOAD_SIZE_MISMATCH')

    // 长度对齐但内容不是声明类型的魔数
    storage.fulfillUpload(created.uploadUrl, Buffer.alloc(png.length, 0x41))
    const mimeMismatch = await complete()
    expect(mimeMismatch.statusCode).toBe(409)
    expect(mimeMismatch.json().code).toBe('UPLOAD_MIME_MISMATCH')
  })

  it('纸页创建绑定已上传资产，私有访问按归属校验', async () => {
    const { created } = await fulfillAndComplete()

    const paper = await app.inject({
      method: 'POST',
      url: '/api/papers',
      headers: { 'x-user-id': USER_A, 'idempotency-key': crypto.randomUUID() },
      payload: { content: '带图片的记录', assetUploadIds: [created.uploadId] },
    })
    expect(paper.statusCode).toBe(201)

    const access = await app.inject({
      method: 'GET',
      url: `/api/paper-assets/${created.assetId}/access`,
      headers: { 'x-user-id': USER_A },
    })
    expect(access.statusCode).toBe(200)
    expect(access.json().url).toContain(UPLOAD_ID)
    expect(typeof access.json().expiresAt).toBe('string')

    const foreign = await app.inject({
      method: 'GET',
      url: `/api/paper-assets/${created.assetId}/access`,
      headers: { 'x-user-id': USER_B },
    })
    expect(foreign.statusCode).toBe(404)
  })

  it('拒绝绑定未完成直传的资产并回滚纸页创建', async () => {
    const pending = await createUpload()

    const paper = await app.inject({
      method: 'POST',
      url: '/api/papers',
      headers: { 'x-user-id': USER_A, 'idempotency-key': crypto.randomUUID() },
      payload: { content: '不该创建成功的记录', assetUploadIds: [pending.json().uploadId] },
    })
    expect(paper.statusCode).toBe(400)
    expect(paper.json().code).toBe('UPLOAD_NOT_AVAILABLE')

    const list = await app.inject({
      method: 'GET',
      url: '/api/papers',
      headers: { 'x-user-id': USER_A },
    })
    expect(list.json().items).toHaveLength(0)
  })

  it('取消上传删除对象，已绑定资产不可取消', async () => {
    await createUpload()
    const cancelled = await app.inject({
      method: 'DELETE',
      url: `/api/uploads/${UPLOAD_ID}`,
      headers: { 'x-user-id': USER_A },
    })
    expect(cancelled.statusCode).toBe(200)
    expect(cancelled.json()).toEqual({ uploadId: UPLOAD_ID, deleted: true })

    // 会话已软删,不能再次完成,同 uploadId 也不能复用
    expect((await complete()).statusCode).toBe(404)
    expect((await createUpload()).statusCode).toBe(409)

    // 换一个新 uploadId 走完整链路并绑定纸页
    const attachUploadId = '44444444-4444-4444-8444-444444444444'
    const { created } = await fulfillAndComplete(USER_A, attachUploadId)
    const paper = await app.inject({
      method: 'POST',
      url: '/api/papers',
      headers: { 'x-user-id': USER_A, 'idempotency-key': crypto.randomUUID() },
      payload: { content: '带绑定资产的记录', assetUploadIds: [created.uploadId] },
    })
    expect(paper.statusCode).toBe(201)

    const cancelAttached = await app.inject({
      method: 'DELETE',
      url: `/api/uploads/${attachUploadId}`,
      headers: { 'x-user-id': USER_A },
    })
    expect(cancelAttached.statusCode).toBe(409)
  })
})
