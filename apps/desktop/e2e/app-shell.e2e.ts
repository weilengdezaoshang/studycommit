import { expect, test, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

async function launchApp(userDataDir: string): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    args: ['.', `--user-data-dir=${userDataDir}`],
    cwd: join(__dirname, '..')
  })
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  return { app, page }
}

test.describe('StudyCommit desktop shell', () => {
  let userDataDir: string
  let app: ElectronApplication
  let page: Page

  test.beforeEach(async () => {
    userDataDir = await mkdtemp(join(tmpdir(), 'studycommit-e2e-'))
    ;({ app, page } = await launchApp(userDataDir))
  })

  test.afterEach(async () => {
    await app.close()
    await rm(userDataDir, { recursive: true, force: true })
  })

  test('starts the production app and connects main, preload, and renderer', async () => {
    await expect(page).toHaveTitle('StudyCommit')
    await expect(page.getByRole('heading', { name: '今天', level: 1, exact: true })).toBeVisible()

    const bridge = await page.evaluate(() => {
      const browserWindow = window as unknown as Record<string, unknown>
      const api = browserWindow.studyCommit as Record<string, unknown>
      return {
        platform: api.platform,
        keys: Object.keys(api),
        requireType: typeof browserWindow.require
      }
    })

    expect(typeof bridge.platform).toBe('string')
    expect(bridge.keys).toEqual(['platform'])
    expect(bridge.requireType).toBe('undefined')
  })

  test('navigates in the real window and reloads a deep hash route', async () => {
    await page.getByRole('link', { name: '草稿' }).click()
    await expect(page.getByRole('heading', { name: '草稿', level: 1, exact: true })).toBeVisible()
    await expect(page).toHaveURL(/#\/drafts$/)

    await page.evaluate(() => {
      window.location.hash = '#/topics/topic-1/map'
    })
    await expect(page.getByRole('heading', { name: '知识地图' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: '知识地图' })).toBeVisible()
  })

  test('restores the last top-level page after an application restart', async () => {
    await page.getByRole('link', { name: '草稿' }).click()
    await expect(page.getByRole('heading', { name: '草稿', level: 1, exact: true })).toBeVisible()
    await app.close()

    ;({ app, page } = await launchApp(userDataDir))
    await expect(page.getByRole('heading', { name: '草稿', level: 1, exact: true })).toBeVisible()
  })
})
