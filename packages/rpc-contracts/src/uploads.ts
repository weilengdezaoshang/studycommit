import { oc } from '@orpc/contract'
import { z } from 'zod'

/**
 * 图片上传会话与私有资源访问契约(BE-308)。
 * 三步直传:创建会话 → 客户端 PUT 签名地址 → complete 核对;
 * 服务器不过图片二进制,桶私有,读取一律走短时签名地址。
 */

export const assetKindSchema = z.enum(['image', 'source_screenshot'])

export const assetMimeTypeSchema = z.enum(['image/png', 'image/jpeg', 'image/webp'])

export const ASSET_MAX_SIZE_BYTES = 10 * 1024 * 1024

export const createUploadInputSchema = z.object({
  /** 客户端生成的 UUID,作为幂等键:同参重试返回同一会话,异参冲突 */
  uploadId: z.uuid(),
  kind: assetKindSchema,
  mimeType: assetMimeTypeSchema,
  sizeBytes: z.number().int().positive().max(ASSET_MAX_SIZE_BYTES),
  /** 客户端计算的文件 SHA-256(小写 hex) */
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
})

export const createUploadOutputSchema = z.object({
  uploadId: z.uuid(),
  assetId: z.uuid(),
  kind: assetKindSchema,
  status: z.literal('pending'),
  /** 签名 PUT 直传地址(15 分钟有效) */
  uploadUrl: z.string().url(),
  /** 客户端 PUT 时必须携带的请求头 */
  headers: z.record(z.string(), z.string()),
  expiresAt: z.iso.datetime({ offset: true }),
})

export const completeUploadOutputSchema = z.object({
  uploadId: z.uuid(),
  assetId: z.uuid(),
  kind: assetKindSchema,
  status: z.literal('uploaded'),
  mimeType: assetMimeTypeSchema,
  sizeBytes: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
})

export const assetAccessOutputSchema = z.object({
  assetId: z.uuid(),
  url: z.string().url(),
  expiresAt: z.iso.datetime({ offset: true }),
})

export const uploadsContract = {
  create: oc
    .route({ method: 'POST', path: '/uploads', successStatus: 201, summary: '创建直传会话' })
    .input(createUploadInputSchema)
    .output(createUploadOutputSchema),
  complete: oc
    .route({
      method: 'POST',
      path: '/uploads/{uploadId}/complete',
      successStatus: 200,
      summary: '完成上传并核对对象',
    })
    .input(z.object({ uploadId: z.uuid() }))
    .output(completeUploadOutputSchema),
  remove: oc
    .route({
      method: 'DELETE',
      path: '/uploads/{uploadId}',
      summary: '取消上传并清理对象',
    })
    .input(z.object({ uploadId: z.uuid() }))
    .output(z.object({ uploadId: z.uuid(), deleted: z.literal(true) })),
  access: oc
    .route({
      method: 'GET',
      path: '/paper-assets/{id}/access',
      summary: '换取私有资源的短时访问地址',
    })
    .input(z.object({ id: z.uuid() }))
    .output(assetAccessOutputSchema),
}

export type AssetKind = z.infer<typeof assetKindSchema>
export type AssetMimeType = z.infer<typeof assetMimeTypeSchema>
export type CreateUploadInput = z.infer<typeof createUploadInputSchema>
export type CreateUploadOutput = z.infer<typeof createUploadOutputSchema>
export type CompleteUploadOutput = z.infer<typeof completeUploadOutputSchema>
export type AssetAccessOutput = z.infer<typeof assetAccessOutputSchema>
