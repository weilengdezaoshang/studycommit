import { expect, test, _electron as electron } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('arranges and restores the growth desk demo', async ({ browserName }, testInfo) => {
  void browserName
  const userDataDir = await mkdtemp(join(tmpdir(), 'studycommit-desk-e2e-'))
  const app = await electron.launch({
    args: ['.', `--user-data-dir=${userDataDir}`],
    cwd: join(__dirname, '..'),
  })

  try {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('link', { name: '成长书桌' }).click()
    await expect(page.getByRole('heading', { name: '成长书桌', level: 1 })).toBeVisible()
    await expect(page.getByTestId('desk-stage')).toBeVisible()
    await expect(page.locator('canvas[data-three-renderer="webgl"]')).toBeVisible()
    await expect(page.getByText('傍晚 · 安静陪学中')).toBeVisible()
    await page.getByRole('button', { name: '傍晚 · 安静陪学中' }).click()
    await expect(page.getByRole('button', { name: '环境动效已暂停' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    await page.getByRole('button', { name: '环境动效已暂停' }).click()
    await expect(page.getByRole('button', { name: '傍晚 · 安静陪学中' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await page.screenshot({ path: testInfo.outputPath('desk-browse.png'), fullPage: true })

    await page.getByRole('button', { name: '布置' }).click()
    const cat = page.getByRole('button', { name: '陶瓷小猫' })
    await cat.click()
    await page.getByRole('button', { name: '向右转' }).click()
    await expect(page.getByLabel('旋转物品').locator('output')).toHaveText('15°')

    const canvas = page.locator('canvas[data-three-renderer="webgl"]')
    const canvasBox = await canvas.boundingBox()
    if (!canvasBox) {
      throw new Error('Three.js 画布未渲染')
    }
    await page.mouse.move(
      canvasBox.x + canvasBox.width * 0.2,
      canvasBox.y + canvasBox.height * 0.63,
    )
    await page.mouse.down()
    await page.mouse.move(
      canvasBox.x + canvasBox.width * 0.29,
      canvasBox.y + canvasBox.height * 0.65,
      { steps: 8 },
    )
    await page.mouse.up()
    await expect(page.getByRole('heading', { name: '黄铜台灯', level: 3 })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('desk-edit.png'), fullPage: true })

    await page.getByRole('button', { name: '保存布局' }).click()
    await expect(page.getByRole('button', { name: '已保存' })).toBeDisabled()
    await page.reload()
    await expect(page.getByRole('heading', { name: '成长书桌', level: 1 })).toBeVisible()
    await page.getByRole('button', { name: '布置' }).click()
    await expect(page.getByRole('button', { name: '黄铜台灯' })).toBeVisible()
  } finally {
    await app.close()
    await rm(userDataDir, { recursive: true, force: true })
  }
})
