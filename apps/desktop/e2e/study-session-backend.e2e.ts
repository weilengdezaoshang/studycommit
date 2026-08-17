import {
  expect,
  test,
  _electron as electron,
  type ElectronApplication,
  type Page,
} from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { activeStudySessionResponseSchema } from '@studycommit/common/contracts'

const apiOrigin = process.env.STUDYCOMMIT_API_ORIGIN ?? 'http://localhost:3000'
const apiPrefix = process.env.STUDYCOMMIT_API_PREFIX ?? '/api'

async function waitForBackend(): Promise<void> {
  const deadline = Date.now() + 10_000
  let lastError: unknown
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${apiOrigin}${apiPrefix}/study-sessions/active`)
      if (response.status > 0) {
        return
      }
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(
    `真实后端未就绪，请先运行 pnpm backend:start${lastError instanceof Error ? `：${lastError.message}` : ''}`,
  )
}

test.describe('真实后端学习会话请求', () => {
  let userDataDir: string
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async () => {
    await waitForBackend()
  })

  test.beforeEach(async () => {
    userDataDir = await mkdtemp(join(tmpdir(), 'studycommit-backend-e2e-'))
    app = await electron.launch({
      args: ['.', `--user-data-dir=${userDataDir}`],
      cwd: join(__dirname, '..'),
      env: {
        ...process.env,
        NODE_ENV: 'production',
        STUDYCOMMIT_API_ORIGIN: apiOrigin,
        STUDYCOMMIT_API_PREFIX: apiPrefix,
        STUDYCOMMIT_ALLOW_INSECURE_HTTP: 'true',
        STUDYCOMMIT_DEV_USER_ID: '11111111-1111-4111-8111-111111111111',
      },
    })
    page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
  })

  test.afterEach(async () => {
    await app.close()
    await rm(userDataDir, { recursive: true, force: true })
  })

  test('通过 Electron 完整链路读取真实活动学习会话', async () => {
    const result = await page.evaluate(() => window.studyCommit.studySessions.getActive())
    expect(result.ok).toBe(true)
    if (!result.ok) {
      throw new Error(`真实后端请求失败：${result.error.code}`)
    }
    expect(() => activeStudySessionResponseSchema.parse(result.data)).not.toThrow()
    expect(result.data.serverNow).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})
