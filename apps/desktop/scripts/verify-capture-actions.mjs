import { chromium, expect } from '@playwright/test'
import { mkdir, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))

async function main() {
  const output = resolve(
    scriptDir,
    '../../../docs/design/desktop-records-refinement-2026-09-16/implementation',
  )
  await mkdir(output, { recursive: true })
  const preview =
    'data:image/png;base64,' +
    (
      await readFile(resolve(scriptDir, '../../../docs/design/ocr-regression-2026-09-16/1.png'))
    ).toString('base64')
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 850 } })
    await page.addInitScript((preview) => {
      const ok = (data) => ({ ok: true, data })
      localStorage.setItem(
        'studycommit.desktop.auth.session.v1',
        JSON.stringify({
          user: { id: 'visual-test', nickname: '设计验收', avatarUrl: null, status: 'active' },
        }),
      )
      window.studyCommit = {
        auth: { getSession: async () => ok(null) },
        topics: { listActive: async () => ok({ items: [], pageInfo: { hasNextPage: false } }) },
        papers: { list: async () => ok({ items: [], pageInfo: { hasNextPage: false } }) },
        capture: {
          onRequestResult: (listener) => {
            window.openTestCapture = listener
            return () => {}
          },
          preview: async () => ok(preview),
          ocr: async () =>
            ok({
              text: '启动桌面端和移动端\n新增移动端拍照记录功能\n评估后端架构与并发方案\n修复草稿记录无入口问题',
            }),
          request: async () => ok({ status: 'completed', captureId: crypto.randomUUID() }),
          cancel: async () => ok(true),
          upload: () =>
            new Promise((resolveUpload) => {
              window.failTestUpload = () =>
                resolveUpload({ ok: false, error: { message: '测试：网络暂不可用，请重试' } })
            }),
        },
      }
    }, preview)
    await page.goto('http://127.0.0.1:5173/#/auth')
    await page.waitForFunction(() => Boolean(window.openTestCapture))
    await page.evaluate(() =>
      window.openTestCapture({ status: 'completed', captureId: 'visual-capture' }),
    )
    const save = page.getByRole('button', { name: '保存图片记录（1 张）', exact: true })
    const text = page.getByRole('button', { name: '仅保存文字', exact: true })
    await expect(save).toBeEnabled()
    await expect(text).toBeEnabled()
    const primary = await save.boundingBox()
    const secondary = await text.boundingBox()
    expect(primary.width).toBeLessThan(350)
    expect(primary.x).toBeGreaterThan(secondary.x + secondary.width)
    await page.evaluate(() => document.fonts.ready)
    await expect(page.getByRole('textbox', { name: '识别原文' })).toBeVisible()
    await expect(page.getByLabel('这次要弄懂的问题')).not.toBeVisible()
    await expect(page.getByLabel('这次要弄懂的问题')).toHaveValue('')
    await page.screenshot({ path: resolve(output, '17-capture-confirm-handdrawn.png') })
    await page.getByRole('button', { name: '放大查看截图' }).click()
    await expect(page.getByAltText('截图大图')).toBeVisible()
    await page.getByRole('button', { name: '返回编辑' }).click()
    await save.click()
    await expect(page.getByRole('button', { name: '正在保存图片记录' })).toBeDisabled()
    await expect(text).toBeDisabled()
    await page.screenshot({ path: resolve(output, '18-capture-handdrawn-pending.png') })
    await page.evaluate(() => window.failTestUpload())
    await expect(save).toBeEnabled()
    await expect(page.getByRole('alert')).toContainText('网络暂不可用')
    await page.setViewportSize({ width: 480, height: 850 })
    await save.scrollIntoViewIfNeeded()
    await expect(save).toBeInViewport()
    await page.screenshot({ path: resolve(output, '19-capture-handdrawn-narrow.png') })
    await page.setViewportSize({ width: 1100, height: 850 })
    for (let count = 1; count < 9; count++) {
      await page.getByRole('button', { name: `追加截图（${count}/9）` }).click()
    }
    await expect(page.getByRole('button', { name: '追加截图（9/9）' })).toBeDisabled()
    await page.getByRole('button', { name: '删除第 9 张' }).click()
    await expect(page.getByRole('button', { name: '追加截图（8/9）' })).toBeEnabled()
    await page.screenshot({ path: resolve(output, '20-capture-handdrawn-multiple.png') })
    console.log(
      '通过：正文直接编辑、疑问默认空白收起、大图查看、保存中禁用、失败恢复、窄屏与多图上限。',
    )
  } finally {
    await browser.close()
  }
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
