import { z } from 'zod'

export const captureSourceSchema = z.enum([
  'desktop-screenshot',
  'mobile-camera',
  'mobile-library',
  'miniprogram-library',
])

export const ocrResultSchema = z.object({
  text: z.string(),
  confidence: z.number().min(0).max(1).nullable(),
  language: z.string().min(1).nullable(),
})

export const captureStatusSchema = z.enum([
  'pending',
  'uploaded',
  'processing',
  'completed',
  'failed',
])

export const captureUploadInputSchema = z.object({
  source: captureSourceSchema,
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(20 * 1024 * 1024),
})

export const captureRecordSchema = z.object({
  id: z.string().min(1),
  source: captureSourceSchema,
  status: captureStatusSchema,
  imageUrl: z.string().url().nullable(),
  ocr: ocrResultSchema.nullable(),
  createdAt: z.iso.datetime({ offset: true }),
})

export type CaptureSource = z.infer<typeof captureSourceSchema>
export type OcrResult = z.infer<typeof ocrResultSchema>
export type CaptureRecord = z.infer<typeof captureRecordSchema>
