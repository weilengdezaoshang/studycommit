import { chromium, expect } from '@playwright/test'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 600 } })
    await page.addInitScript(() => {
      let listener
      const ok = () => Promise.resolve({ ok: true, data: { ok: true } })
      window.captureChecks = { selected: [], cancelled: 0 }
      window.studyCommit = {
        capture: {
          onRequestResult: () => () => {},
          onOverlayState: (callback) => {
            listener = callback
            return () => {
              listener = null
            }
          },
          overlayReady: () => {
            listener?.({
              imageDataUrl:
                'data:image/svg+xml,' +
                encodeURIComponent(
                  '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><rect width="900" height="600" fill="#e9edf3"/></svg>',
                ),
              width: 900,
              height: 600,
              scaleFactor: 1,
            })
            return ok()
          },
          overlaySelection: ({ selection }) => {
            window.captureChecks.selected.push(selection)
            return ok()
          },
          overlayCancel: () => {
            window.captureChecks.cancelled += 1
            return ok()
          },
        },
      }
    })
    await page.goto('http://127.0.0.1:4178/#/capture-overlay')
    const confirm = page.getByRole('button', { name: '确认截图 · Enter' })
    await expect(confirm).toBeDisabled()
    await page.mouse.move(100, 100)
    await page.mouse.down()
    await page.mouse.move(780, 450)
    await expect(page.getByRole('group', { name: '截图操作' })).toHaveCount(0)
    await page.mouse.up()
    await expect(confirm).toBeEnabled()
    await expect(confirm).toBeInViewport()
    const toolbar = page.locator('.capture-selection-actions')
    await expect(toolbar).toHaveCSS('top', '462px')
    await expect(page.getByRole('button', { name: '取消截图 · Esc' })).toBeInViewport()
    await page.screenshot({
      path: resolve(
        scriptDir,
        '../../../docs/design/desktop-records-refinement-2026-09-16/implementation/09-capture-selection.png',
      ),
    })
    await confirm.click()
    expect(await page.evaluate(() => window.captureChecks.selected)).toEqual([
      { x: 100, y: 100, width: 680, height: 350 },
    ])
    await page.reload()
    await page.mouse.move(100, 300)
    await page.mouse.down()
    await page.mouse.move(780, 590)
    await page.mouse.up()
    const above = await toolbar.boundingBox()
    expect(above.y + above.height).toBeLessThanOrEqual(288)
    await page.getByRole('button', { name: '取消截图 · Esc' }).click()
    expect(await page.evaluate(() => window.captureChecks)).toEqual({ selected: [], cancelled: 1 })
    console.log('通过：选区按钮可见、无选区禁用、点击确认坐标准确、点击取消不提交。')
  } finally {
    await browser.close()
  }
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
