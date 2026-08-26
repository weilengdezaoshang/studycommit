import { expect, test, _electron as electron } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('completes the bitmap companion interaction loop', async ({ browserName }, testInfo) => {
  void browserName
  const userDataDir = await mkdtemp(join(tmpdir(), 'studycommit-companion-e2e-'))
  const app = await electron.launch({
    args: ['.', `--user-data-dir=${userDataDir}`],
    cwd: join(__dirname, '..'),
  })

  try {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: '体验陪学伙伴 Demo' }).click()
    await expect(page.getByRole('heading', { name: '你开始学，它才走过来' })).toBeVisible()

    await page.getByRole('button', { name: '开始 25 分钟陪学' }).click()
    await expect(page.locator('[data-motion="arriving"]')).toBeVisible()
    await expect(page.locator('[data-motion="settling"]')).toBeVisible()
    await expect(page.locator('[data-motion="studying"]')).toBeVisible()
    await page.screenshot({
      path: testInfo.outputPath('bitmap-companion-studying.png'),
      fullPage: true,
    })

    await page.getByRole('button', { name: '暂停一下' }).click()
    await expect(page.locator('[data-motion="pausing"]')).toBeVisible()
    await expect(page.locator('[data-motion="looking"]')).toBeVisible()
    await page.screenshot({
      path: testInfo.outputPath('bitmap-companion-looking.png'),
      fullPage: true,
    })
    await page.getByRole('button', { name: '继续学习' }).click()

    await page.getByRole('button', { name: '演示：完成学习' }).click()
    await expect(page.locator('[data-motion="leaving-study"]')).toBeVisible()
    await expect(page.locator('[data-motion="gift-arriving"]')).toBeVisible()
    await expect(page.locator('[data-motion="reward"]')).toBeVisible()
    await page.getByRole('button', { name: '接过它的信封' }).click()
    await expect(page.getByRole('dialog', { name: '学习奖励' })).toBeVisible()
    await page.screenshot({
      path: testInfo.outputPath('bitmap-companion-reward.png'),
      fullPage: true,
    })

    await page.getByRole('button', { name: '收进本周手帐' }).click()
    await expect(page.getByText('本周第 3 次完成')).toBeVisible()
  } finally {
    await app.close()
    await rm(userDataDir, { recursive: true, force: true })
  }
})
