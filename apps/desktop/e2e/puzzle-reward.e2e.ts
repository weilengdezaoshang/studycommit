import { test, expect } from '@playwright/test'
/** 启动 packages/puzzle-ui 的 Vite 预览后运行；不连接生产接口。 */
test.use({ channel: 'chrome' })
const origin = process.env.PUZZLE_PREVIEW_URL
// 此套件显式启用，避免默认 Electron 测试依赖额外预览服务。
test.skip(!origin, '设置 PUZZLE_PREVIEW_URL 指向本地画册预览')
test('刮开前不显示新碎片且揭晓后只增加一块', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(origin!)
  await page.getByRole('button', { name: '擦开一小块', exact: true }).click()
  await expect(page.locator('.puzzle-board image')).toHaveCount(5)
  await page.getByRole('button', { name: '直接揭晓', exact: true }).click()
  await expect(page.getByRole('heading', { name: '又拼好了一小块' })).toBeVisible()
  await expect(page.locator('.puzzle-board image')).toHaveCount(6)
  await expect(page.getByRole('button', { name: '看看画册', exact: true })).toBeEnabled()
})
test('手机尺寸擦除达到阈值自动归位且没有横向溢出', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(origin!)
  await page.getByRole('button', { name: '擦开一小块', exact: true }).click()
  const box = (await page.locator('canvas').boundingBox())!
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2)
  await page.mouse.down()
  for (let y = 0.25; y < 0.85; y += 0.13) {
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * y, { steps: 8 })
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * y, { steps: 14 })
  }
  await page.mouse.up()
  await expect(page.getByRole('button', { name: '看看画册', exact: true })).toBeEnabled()
  await expect(page.locator('.puzzle-board image')).toHaveCount(6)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
test('减少动态偏好下直接揭晓不会播放飞行动画', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(origin!)
  await page.getByRole('button', { name: '擦开一小块', exact: true }).click()
  await page.getByRole('button', { name: '直接揭晓', exact: true }).click()
  await expect(page.getByRole('button', { name: '看看画册', exact: true })).toBeEnabled()
  expect(
    await page.locator('.puzzle-flyer').evaluate((node) => getComputedStyle(node).visibility),
  ).toBe('hidden')
})
