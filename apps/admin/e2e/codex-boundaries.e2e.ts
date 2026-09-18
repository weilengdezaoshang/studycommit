import { expect, test, type Page } from '@playwright/test'
import {
  campaignDetail,
  campaignList,
  IDS,
  loginResponse,
  meSuperAdmin,
  overview,
} from './fixtures'

async function prepare(page: Page, options: { draft?: boolean; failure?: number } = {}) {
  const detail = structuredClone(campaignDetail)
  detail.status = options.draft ? 'draft' : 'published'
  detail.draftConfig!.name = '内部运营标识'
  detail.draftConfig!.eligibility.providers = ['phone']
  let submitted: Record<string, unknown> | undefined
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const method = route.request().method()
    if (path.endsWith('/account/login')) {
return route.fulfill({ json: loginResponse })
}
    if (path.endsWith('/access/me')) {
return route.fulfill({ json: meSuperAdmin })
}
    if (path.endsWith('/overview')) {
return route.fulfill({ json: overview })
}
    if (path === '/api/admin/campaigns') {
return route.fulfill({ json: { ...campaignList, items: [detail] } })
}
    if (path === `/api/admin/campaigns/${IDS.campaign}`) {
return route.fulfill({ json: detail })
}
    if (path.endsWith('/claims')) {
return route.fulfill({ json: { items: [], nextCursor: null } })
}
    if (method !== 'GET') {
      submitted = route.request().postDataJSON()
      if (options.failure) {
return route.fulfill({
          status: options.failure,
          json: {
            code: options.failure === 409 ? 'CAMPAIGN_VERSION_CONFLICT' : 'GATEWAY_TIMEOUT',
            message: '测试异常',
          },
        })
}
      return route.fulfill({ json: detail })
    }
    return route.fulfill({ status: 404, json: { code: 'NOT_FOUND' } })
  })
  await page.goto('/login')
  await page.getByLabel('账号', { exact: true }).fill('admin')
  await page.getByLabel('密码', { exact: true }).fill('password123')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await page.locator('a[href="/campaigns"]').first().click()
  await page.getByRole('button', { name: '查看', exact: true }).click()
  return { detail, submitted: () => submitted }
}

test('真实编辑表单保留未展示的内部名称和领取资格', async ({ page }) => {
  const state = await prepare(page, { draft: true })
  await page.getByRole('button', { name: '编辑草稿', exact: true }).click()
  await page.getByLabel('活动标题', { exact: true }).fill('更新公开标题')
  await page.getByLabel('操作理由', { exact: true }).fill('仅调整公开标题')
  await page.getByRole('button', { name: '保存草稿', exact: true }).click()
  await expect.poll(() => state.submitted()).toBeTruthy()
  expect(state.submitted()!.config.name).toBe('内部运营标识')
  expect(state.submitted()!.config.eligibility.providers).toEqual(['phone'])
  expect(state.submitted()!.config.copy.title).toBe('更新公开标题')
})

test('编辑发生版本冲突后保留输入并锁定保存', async ({ page }) => {
  const state = await prepare(page, { draft: true, failure: 409 })
  await page.getByRole('button', { name: '编辑草稿', exact: true }).click()
  await page.getByLabel('活动标题', { exact: true }).fill('待人工合并的标题')
  await page.getByLabel('操作理由', { exact: true }).fill('测试冲突')
  await page.getByRole('button', { name: '保存草稿', exact: true }).click()
  await expect.poll(() => state.submitted()).toBeTruthy()
  await expect(page.getByRole('button', { name: /保存草稿/ })).toBeDisabled()
  await expect(page.getByLabel('活动标题', { exact: true })).toHaveValue('待人工合并的标题')
})

test('暂停结果不明时关闭弹窗后不能重复提交', async ({ page }) => {
  await prepare(page, { failure: 504 })
  await page.getByRole('button', { name: '暂停', exact: true }).click()
  await page.getByPlaceholder('请输入操作理由').fill('临时暂停活动')
  await page.getByRole('button', { name: '确认暂停', exact: true }).click()
  await expect(
    page.getByRole('dialog').locator('.ant-alert-message', { hasText: '操作结果待确认' }),
  ).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click()
  const reopen = page.getByRole('button', { name: '暂停', exact: true })
  if (await reopen.isEnabled()) {
    await reopen.click()
    await expect(
      page.getByRole('dialog').locator('.ant-alert-message', { hasText: '操作结果待确认' }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: '确认暂停', exact: true })).toHaveCount(0)
  } else {
    await expect(reopen).toBeDisabled()
  }
})
