const { chromium, expect } = require('@playwright/test')
const { createRequire } = require('node:module')
const { resolve } = require('node:path')
const { randomUUID } = require('node:crypto')
const apiRequire = createRequire(resolve(__dirname, '../../api/package.json'))
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } =
  apiRequire('@aws-sdk/client-s3')
const { getSignedUrl } = apiRequire('@aws-sdk/s3-request-presigner')

// 隔离记录夹具 + 真实本机对象存储；不读取或改动用户记录。
async function main() {
  process.loadEnvFile(resolve(__dirname, '../../api/.env'))
  if (!['http://127.0.0.1:9000', 'http://localhost:9000'].includes(process.env.S3_ENDPOINT)) {
    throw new Error('仅允许明确的本机开发存储')
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
  const object = {
    Bucket: process.env.S3_BUCKET || 'studycommit-assets',
    Key: `diagnostics/record-image-${randomUUID()}.png`,
  }
  let browser
  try {
    await client.send(
      new PutObjectCommand({
        ...object,
        ContentType: 'image/png',
        Body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
          'base64',
        ),
      }),
    )
    const url = await getSignedUrl(client, new GetObjectCommand(object), { expiresIn: 120 })
    browser = await chromium.launch({ channel: 'chrome', headless: true })
    const page = await browser.newPage()
    await page.addInitScript(
      ({ imageUrl }) => {
        const ok = (data) => ({ ok: true, data })
        const paper = {
          id: 'image-test',
          content: '图片显示回归验证',
          contentDocument: null,
          status: 'inbox',
          topicId: null,
          version: 1,
          createdAt: '2026-09-16T08:00:00.000Z',
          updatedAt: '2026-09-16T08:00:00.000Z',
          deletedAt: null,
          questionText: null,
          understandingText: null,
          questionStatus: 'none',
          assets: [{ id: 'asset-test', mimeType: 'image/png', width: 1, height: 1 }],
        }
        localStorage.setItem(
          'studycommit.desktop.auth.session.v1',
          JSON.stringify({
            user: { id: 'visual-test', nickname: '图片验收', status: 'active', avatarUrl: null },
          }),
        )
        window.assetRequests = 0
        window.studyCommit = {
          auth: { getSession: async () => ok(null) },
          capture: { onRequestResult: () => () => {} },
          topics: { listActive: async () => ok({ items: [], pageInfo: { hasNextPage: false } }) },
          papers: {
            list: async () => ok({ items: [paper], pageInfo: { hasNextPage: false } }),
            get: async () => ok(paper),
            knowledge: async () =>
              ok({
                additions: [],
                relations: [],
                additionsHasMore: false,
                relationsHasMore: false,
              }),
            assetAccess: async () => {
              window.assetRequests++
              return ok({
                assetId: 'asset-test',
                url:
                  window.assetRequests === 1
                    ? imageUrl.replace(/X-Amz-Signature=[^&]+/, 'X-Amz-Signature=invalid')
                    : imageUrl,
                expiresAt: new Date(Date.now() + 120000).toISOString(),
              })
            },
          },
        }
      },
      { imageUrl: url },
    )
    await page.goto('http://127.0.0.1:4178/#/papers/image-test')
    await expect(page.getByText('图片 1 加载失败')).toBeVisible()
    await page.getByRole('button', { name: '重新加载', exact: true }).click()
    const image = page.getByAltText('记录图片 1', { exact: true })
    await expect(image).toBeVisible()
    await expect
      .poll(() => image.evaluate((img) => img.complete && img.naturalWidth > 0))
      .toBe(true)
    await page.getByRole('button', { name: '查看第 1 张图片' }).click()
    const large = page.getByAltText('记录图片大图')
    await expect(large).toBeVisible()
    await expect
      .poll(() => large.evaluate((img) => img.complete && img.naturalWidth > 0))
      .toBe(true)
    console.log('通过：无效签名显示失败，重试刷新地址，真实存储图片在记录详情及大图中成功解码。')
  } finally {
    await browser?.close()
    await client.send(new DeleteObjectCommand(object))
    client.destroy()
    console.log('仅删除本次诊断图片，未改动用户数据。')
  }
}
main().catch(() => {
  console.error('图片链路验证未通过，请检查本机存储或预览服务。')
  process.exitCode = 1
})
