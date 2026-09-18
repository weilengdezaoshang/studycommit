import { expect, test } from '@playwright/test'
import { aiConfig, aiProvider, loginResponse, meSuperAdmin, overview, prices } from './fixtures'

test('尚无价格版本时可以显式配置模型并发布首个价格', async ({ page }) => {
  type FirstPricePost = { configSnapshot: { model: string; estimatedCostPerRun: string } }
  let posted: FirstPricePost | null = null
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/account/login')) {
      return route.fulfill({ json: loginResponse })
    }
    if (path.endsWith('/access/me')) {
      return route.fulfill({ json: meSuperAdmin })
    }
    if (path.endsWith('/overview')) {
      return route.fulfill({ json: overview })
    }
    if (path.endsWith('/ai/config')) {
      return route.fulfill({ json: aiConfig })
    }
    if (path.endsWith('/ai/provider')) {
      return route.fulfill({ json: aiProvider })
    }
    if (path.endsWith('/ai/prices')) {
      if (route.request().method() === 'POST') {
        posted = route.request().postDataJSON() as FirstPricePost
        return route.fulfill({ json: { ...prices.items[0], ...posted, version: 1 } })
      }
      return route.fulfill({ json: { items: [] } })
    }
    return route.fulfill({ status: 404, json: { code: 'NOT_FOUND' } })
  })
  await page.goto('/login')
  await page.getByLabel('账号', { exact: true }).fill('admin')
  await page.getByLabel('密码', { exact: true }).fill('password123')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await page.locator('a[href="/pricing"]').first().click()
  await page.getByRole('button', { name: '发布新价格', exact: true }).click()
  const modal = page.getByRole('dialog')
  await modal.getByLabel('新价格', { exact: true }).fill('5')
  await modal.getByLabel('成本估算 (CNY)', { exact: true }).fill('0.010000')
  await modal.getByLabel('使用模型', { exact: true }).fill('approved-model')
  await modal.getByPlaceholder('请输入操作理由').fill('首次配置已批准模型与价格')
  await modal.getByRole('button', { name: '确认发布', exact: true }).click()
  await expect.poll(() => posted).toBeTruthy()
  const firstPosted = posted as unknown as FirstPricePost
  expect(firstPosted.configSnapshot.model).toBe('approved-model')
  expect(firstPosted.configSnapshot.estimatedCostPerRun).toBe('0.010000')
})

test('已有价格时允许更换计费模型，提交使用本次表单模型', async ({ page }) => {
  type PricePost = { configSnapshot: { model: string }; priceCredits: number }
  let posted: PricePost | null = null
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/account/login')) {
      return route.fulfill({ json: loginResponse })
    }
    if (path.endsWith('/access/me')) {
      return route.fulfill({ json: meSuperAdmin })
    }
    if (path.endsWith('/overview')) {
      return route.fulfill({ json: overview })
    }
    if (path.endsWith('/ai/config')) {
      return route.fulfill({ json: aiConfig })
    }
    if (path.endsWith('/ai/provider')) {
      return route.fulfill({ json: aiProvider })
    }
    if (path.endsWith('/ai/prices')) {
      if (route.request().method() === 'POST') {
        posted = route.request().postDataJSON() as PricePost
        return route.fulfill({ json: { ...prices.items[0], ...posted, version: 4 } })
      }
      return route.fulfill({ json: prices })
    }
    return route.fulfill({ status: 404, json: { code: 'NOT_FOUND' } })
  })
  await page.goto('/login')
  await page.getByLabel('账号', { exact: true }).fill('admin')
  await page.getByLabel('密码', { exact: true }).fill('password123')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await page.locator('a[href="/pricing"]').first().click()
  await page.getByRole('button', { name: '发布新价格', exact: true }).click()
  const modal = page.getByRole('dialog')
  await expect(modal.getByLabel('使用模型', { exact: true })).toHaveValue('active-model')
  await expect(modal.getByLabel('使用模型', { exact: true })).toBeEnabled()
  await modal.getByLabel('使用模型', { exact: true }).fill('new-billed-model')
  await modal.getByLabel('新价格', { exact: true }).fill('8')
  await modal.getByLabel('成本估算 (CNY)', { exact: true }).fill('0.020000')
  await expect(modal.getByText('计费模型将从 active-model 更换为 new-billed-model')).toBeVisible()
  await modal.getByPlaceholder('请输入操作理由').fill('发布新计费模型')
  await modal.getByRole('button', { name: '确认发布', exact: true }).click()
  await expect.poll(() => posted).toBeTruthy()
  const published = posted as unknown as PricePost
  expect(published.configSnapshot.model).toBe('new-billed-model')
  expect(published.priceCredits).toBe(8)
})

test('服务商配置保存需要理由且测试连接不会提交保存', async ({ page }) => {
  let saved: unknown = null
  let tested: unknown = null
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/account/login')) {
      return route.fulfill({ json: loginResponse })
    }
    if (path.endsWith('/access/me')) {
      return route.fulfill({ json: meSuperAdmin })
    }
    if (path.endsWith('/overview')) {
      return route.fulfill({ json: overview })
    }
    if (path.endsWith('/ai/config')) {
      return route.fulfill({ json: aiConfig })
    }
    if (path.endsWith('/ai/prices')) {
      return route.fulfill({ json: { items: [] } })
    }
    if (path.endsWith('/ai/provider/test')) {
      tested = route.request().postDataJSON()
      return route.fulfill({
        json: {
          ok: true,
          code: 'connected',
          message: '连接成功',
          testedAt: '2026-09-18T10:40:00+08:00',
          persisted: false,
        },
      })
    }
    if (path.endsWith('/ai/provider')) {
      if (route.request().method() === 'PUT') {
        saved = route.request().postDataJSON()
        return route.fulfill({
          json: { ...aiProvider, version: 3, displayStatus: 'configured_unverified' },
        })
      }
      return route.fulfill({
        json: { ...aiProvider, hasApiKey: false, displayStatus: 'unconfigured' },
      })
    }
    return route.fulfill({ status: 404, json: { code: 'NOT_FOUND' } })
  })
  await page.goto('/login')
  await page.getByLabel('账号', { exact: true }).fill('admin')
  await page.getByLabel('密码', { exact: true }).fill('password123')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await page.locator('a[href="/pricing"]').first().click()
  await page.getByRole('button', { name: '配置服务商', exact: true }).click()
  const modal = page.getByRole('dialog')
  await modal.locator('#provider-model').fill('gpt-test')
  await modal.locator('#provider-api-key').fill('sk-not-real')
  await modal.getByRole('button', { name: '测试连接', exact: true }).click()
  await expect(modal.getByText('连接成功')).toBeVisible()
  expect(tested).toBeTruthy()
  expect(saved).toBeNull()
  await modal.getByPlaceholder('请输入操作理由').fill('接入平台测试密钥')
  await modal.getByRole('button', { name: '保存', exact: true }).click()
  await expect.poll(() => saved).toBeTruthy()
  expect(saved).toMatchObject({
    model: 'gpt-test',
    reason: '接入平台测试密钥',
    operationId: expect.any(String),
  })
})
