import { randomUUID } from 'node:crypto'
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

process.loadEnvFile('.env')
if (!['127.0.0.1', 'localhost'].includes(new URL(process.env.S3_ENDPOINT).hostname)) {
  throw new Error('此诊断仅允许本机开发存储')
}
const client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
})
const Bucket = process.env.S3_BUCKET || 'studycommit-assets'
const Key = `diagnostics/capture-${randomUUID()}.png`
const bytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
  'base64',
)
try {
  const url = await getSignedUrl(
    client,
    new PutObjectCommand({ Bucket, Key, ContentType: 'image/png' }),
    { expiresIn: 60 },
  )
  const result = await fetch(url, {
    method: 'PUT',
    headers: { 'content-type': 'image/png' },
    body: bytes,
    signal: AbortSignal.timeout(15_000),
  })
  if (!result.ok) {
    throw new Error(`直传 HTTP ${result.status}`)
  }
  const object = await client.send(new HeadObjectCommand({ Bucket, Key }))
  if (object.ContentLength !== bytes.length) {
    throw new Error('上传对象大小不匹配')
  }
  console.log('通过：生成签名、PNG 直传、对象大小校验。')
} finally {
  try {
    await client.send(new DeleteObjectCommand({ Bucket, Key }))
    console.log('诊断图片已删除，未操作用户截图。')
  } finally {
    client.destroy()
  }
}
