import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Inject, Injectable, Optional } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { AssetMimeType } from '@studycommit/rpc-contracts/uploads'
import type { AppEnv } from '../config/env'
import { STORAGE_GATEWAY } from './uploads.constants'

/**
 * 对象存储端口:上传模块只依赖该接口,S3 兼容实现与测试内存实现都挂在端口上。
 * 未配置凭据时网关为 null,上传功能整体降级(AI 同款降级模式)。
 */

export type StoragePutInstruction = {
  url: string
  headers: Record<string, string>
  expiresAt: Date
}

export type StorageStat = { size: number; etag: string | null }

export interface StorageGateway {
  presignPut(key: string, contentType: string, ttlSeconds: number): Promise<StoragePutInstruction>
  presignGet(key: string, ttlSeconds: number): Promise<{ url: string; expiresAt: Date }>
  stat(key: string): Promise<StorageStat | null>
  readHead(key: string, bytes: number): Promise<Buffer>
  delete(key: string): Promise<void>
}

export class S3StorageGateway implements StorageGateway {
  private readonly client: S3Client

  constructor(
    private readonly options: {
      endpoint: string
      region: string
      bucket: string
      accessKeyId: string
      secretAccessKey: string
    },
  ) {
    this.client = new S3Client({
      endpoint: options.endpoint,
      region: options.region,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
      forcePathStyle: true,
    })
  }

  async presignPut(
    key: string,
    contentType: string,
    ttlSeconds: number,
  ): Promise<StoragePutInstruction> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000)
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.options.bucket, Key: key, ContentType: contentType }),
      { expiresIn: ttlSeconds },
    )
    return { url, headers: { 'content-type': contentType }, expiresAt }
  }

  async presignGet(key: string, ttlSeconds: number): Promise<{ url: string; expiresAt: Date }> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000)
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.options.bucket, Key: key }),
      { expiresIn: ttlSeconds },
    )
    return { url, expiresAt }
  }

  async stat(key: string): Promise<StorageStat | null> {
    try {
      const head = await this.client.send(
        new HeadObjectCommand({ Bucket: this.options.bucket, Key: key }),
      )
      return { size: head.ContentLength ?? 0, etag: head.ETag ?? null }
    } catch (error) {
      if (isObjectMissing(error)) {
        return null
      }
      throw error
    }
  }

  async readHead(key: string, bytes: number): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.options.bucket,
        Key: key,
        Range: `bytes=0-${bytes - 1}`,
      }),
    )
    const body = await response.Body?.transformToByteArray()
    return Buffer.from(body ?? [])
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.options.bucket, Key: key }))
  }
}

function isObjectMissing(error: unknown): boolean {
  const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } }
  return (
    candidate?.name === 'NotFound' ||
    candidate?.name === 'NoSuchKey' ||
    candidate?.$metadata?.httpStatusCode === 404
  )
}

/** 测试用内存实现:presignPut 记录 url→key 映射,用 fulfillUpload 模拟客户端直传。 */
export class MemoryStorageGateway implements StorageGateway {
  private readonly objects = new Map<string, Buffer>()
  private readonly urlToKey = new Map<string, string>()
  private readonly etags = new Map<string, string>()

  constructor(private readonly bucket: string) {}

  async presignPut(
    key: string,
    contentType: string,
    ttlSeconds: number,
  ): Promise<StoragePutInstruction> {
    const url = `http://minio.local/${this.bucket}/${key}?X-Amz-Algorithm=MEMORY`
    this.urlToKey.set(url, key)
    return {
      url,
      headers: { 'content-type': contentType },
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
    }
  }

  async presignGet(key: string, ttlSeconds: number): Promise<{ url: string; expiresAt: Date }> {
    if (!this.objects.has(key)) {
      throw new Error(`MEMORY_OBJECT_MISSING:${key}`)
    }
    return {
      url: `http://minio.local/${this.bucket}/${key}?X-Amz-Get=MEMORY`,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
    }
  }

  async stat(key: string): Promise<StorageStat | null> {
    const object = this.objects.get(key)
    if (!object) {
      return null
    }
    return { size: object.length, etag: this.etags.get(key) ?? null }
  }

  async readHead(key: string, bytes: number): Promise<Buffer> {
    const object = this.objects.get(key)
    if (!object) {
      throw new Error(`MEMORY_OBJECT_MISSING:${key}`)
    }
    return object.subarray(0, bytes)
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key)
    this.etags.delete(key)
  }

  /** 模拟客户端对签名地址的直传。 */
  fulfillUpload(url: string, data: Buffer): string | null {
    const key = this.urlToKey.get(url)
    if (!key) {
      return null
    }
    this.objects.set(key, data)
    this.etags.set(key, `"${data.length}-${data.subarray(0, 8).toString('hex')}"`)
    return key
  }

  /** 清空全部对象与签名映射(测试隔离用)。 */
  clear(): void {
    this.objects.clear()
    this.urlToKey.clear()
    this.etags.clear()
  }

  has(key: string): boolean {
    return this.objects.has(key)
  }
}

@Injectable()
export class StorageGatewayProvider {
  readonly gateway: StorageGateway | null

  // 显式传入网关用于测试;否则按环境装配,未配置凭据时保持 null 降级
  // 显式 @Inject:esbuild 转译不生成装饰器参数元数据,缺省会导致依赖解析失败
  constructor(
    @Inject(ConfigService) config: ConfigService<AppEnv>,
    @Optional() @Inject(STORAGE_GATEWAY) gateway?: StorageGateway,
  ) {
    this.gateway = gateway === undefined ? createStorageGatewayFromEnv(config) : gateway
  }
}

export function createStorageGatewayFromEnv(config: ConfigService<AppEnv>): StorageGateway | null {
  if (config.get('S3_DRIVER') === 'memory') {
    return new MemoryStorageGateway(config.get('S3_BUCKET') ?? 'studycommit-assets')
  }
  const endpoint = config.get('S3_ENDPOINT')
  const accessKeyId = config.get('S3_ACCESS_KEY_ID')
  const secretAccessKey = config.get('S3_SECRET_ACCESS_KEY')
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    return null
  }
  return new S3StorageGateway({
    endpoint,
    region: config.get('S3_REGION') ?? 'us-east-1',
    bucket: config.get('S3_BUCKET') ?? 'studycommit-assets',
    accessKeyId,
    secretAccessKey,
  })
}

/** 从文件头字节识别真实图片类型(png/jpeg/webp),与声明的 mime 比对。 */
export function detectImageMime(head: Buffer): AssetMimeType | null {
  const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  if (head.length >= 8 && head.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return 'image/png'
  }
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    head.length >= 12 &&
    head.subarray(0, 4).toString('latin1') === 'RIFF' &&
    head.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'image/webp'
  }
  return null
}
