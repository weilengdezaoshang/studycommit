import { expect, test, type Page } from '@playwright/test'
import {
  aiConfig,
  aiProvider,
  auditLogs,
  campaignDetail,
  campaignList,
  claimsPage,
  creditUserDetail,
  creditUsers,
  IDS,
  ledgerPage,
  loginResponse,
  meSuperAdmin,
  meViewer,
  overview,
  prices,
  roles,
  runsPage,
} from './fixtures'

async function mockApi(page: Page, role: 'super_admin' | 'viewer' = 'super_admin') {
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const method = request.method()

    if (path === '/api/auth/account/login' && method === 'POST') {
      const body = request.postDataJSON() as {
        account?: string
        email?: string
        deviceType?: string
      }
      if (body.email) {
        await route.fulfill({
          status: 400,
          json: { code: 'VALIDATION_ERROR', message: '应使用 account' },
        })
        return
      }
      if (body.account && body.deviceType === 'desktop') {
        await route.fulfill({ json: loginResponse })
        return
      }
      await route.fulfill({
        status: 400,
        json: { code: 'VALIDATION_ERROR', message: '登录参数不合法' },
      })
      return
    }
    if (path === '/api/admin/access/me') {
      await route.fulfill({ json: role === 'viewer' ? meViewer : meSuperAdmin })
      return
    }
    if (path === '/api/admin/overview') {
      await route.fulfill({ json: overview })
      return
    }
    if (path === '/api/admin/campaigns' && method === 'GET') {
      await route.fulfill({ json: campaignList })
      return
    }
    if (path === `/api/admin/campaigns/${IDS.campaign}` && method === 'GET') {
      await route.fulfill({ json: campaignDetail })
      return
    }
    if (path === `/api/admin/campaigns/${IDS.campaign}/claims`) {
      await route.fulfill({ json: claimsPage })
      return
    }
    if (path === `/api/admin/campaigns/${IDS.campaign}/publish` && method === 'POST') {
      const body = request.postDataJSON() as { expectedVersion?: number }
      if (body.expectedVersion !== 3) {
        await route.fulfill({
          status: 409,
          json: { code: 'CAMPAIGN_VERSION_CONFLICT', message: '版本已变化' },
        })
        return
      }
      await route.fulfill({ json: campaignDetail })
      return
    }
    if (path === `/api/admin/campaigns/${IDS.campaign}/compensate` && method === 'POST') {
      await route.fulfill({ status: 504, json: { code: 'GATEWAY_TIMEOUT', message: '超时' } })
      return
    }
    if (path === '/api/admin/ai/runs') {
      await route.fulfill({ json: runsPage })
      return
    }
    if (path === `/api/admin/ai/runs/${IDS.run}`) {
      await route.fulfill({ json: runsPage.items[0] })
      return
    }
    if (path === '/api/admin/credits/users' && !url.pathname.includes(IDS.user)) {
      if (!url.searchParams.get('query')) {
        await route.fulfill({
          status: 400,
          json: { code: 'VALIDATION_ERROR', message: 'query 必填' },
        })
        return
      }
      await route.fulfill({ json: creditUsers })
      return
    }
    if (path === `/api/admin/credits/users/${IDS.user}`) {
      await route.fulfill({ json: creditUserDetail })
      return
    }
    if (path === '/api/admin/credits/ledger') {
      await route.fulfill({ json: ledgerPage })
      return
    }
    if (path === '/api/admin/ai/config' && method === 'GET') {
      await route.fulfill({ json: aiConfig })
      return
    }
    if (path === '/api/admin/ai/provider') {
      await route.fulfill({ json: aiProvider })
      return
    }
    if (path === '/api/admin/ai/prices' && method === 'GET') {
      await route.fulfill({ json: prices })
      return
    }
    if (path === '/api/admin/audit-logs') {
      await route.fulfill({ json: auditLogs })
      return
    }
    if (path === '/api/admin/roles' && method === 'GET') {
      await route.fulfill({ json: roles })
      return
    }
    if (path === '/api/admin/roles' && method === 'POST') {
      await route.fulfill({ json: { userId: IDS.user, role: 'publisher' } })
      return
    }
    await route.fulfill({ status: 404, json: { code: 'NOT_FOUND', message: path } })
  })
}

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('账号').fill('admin')
  await page.getByLabel('密码').fill('password1')
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page.getByRole('heading', { name: '运营概览' })).toBeVisible()
}

async function spaGoto(page: Page, path: string) {
  await page.evaluate((target) => {
    const w = window as Window & {
      g_history?: { push: (path: string) => void }
      umi?: { history?: { push: (path: string) => void } }
    }
    if (w.g_history?.push) {
      w.g_history.push(target)
      return
    }
    if (w.umi?.history?.push) {
      w.umi.history.push(target)
      return
    }
    window.history.pushState({}, '', target)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
}

test.describe('管理后台页面', () => {
  test('登录使用 account 参数并进入概览', async ({ page }) => {
    await mockApi(page)
    await login(page)
    await expect(page.getByText('待处理事项')).toBeVisible()
    await expect(page.getByText('超期冻结')).toBeVisible()
    await expect(page.getByText('待补偿领取')).toBeVisible()
  })

  test('活动列表展示游标分页且不含伪造总数', async ({ page }) => {
    await mockApi(page)
    await login(page)
    await page.getByRole('link', { name: '活动管理' }).click()
    await expect(page.getByText('秋日学习计划')).toBeVisible()
    await expect(page.getByText('本次加载 1 条')).toBeVisible()
    await expect(page.getByRole('button', { name: '下一页' })).toBeEnabled()
    await expect(page.getByText('共')).toHaveCount(0)
  })

  test('活动详情可打开发布确认且补偿超时进入待确认', async ({ page }) => {
    await mockApi(page)
    await login(page)
    await page.getByRole('link', { name: '活动管理' }).click()
    await page.getByRole('button', { name: '查看' }).first().click()
    await expect(page.getByRole('heading', { name: '秋日学习计划', exact: true })).toBeVisible()
    await page.getByRole('tab', { name: '待补偿' }).click()
    await page.getByRole('button', { name: '补偿发放' }).click()
    await page.getByPlaceholder('请输入操作理由').fill('补偿网络失败领取')
    await page.getByRole('button', { name: '确认补偿' }).click()
    await expect(
      page.getByRole('dialog').locator('.ant-alert-message', { hasText: '操作结果待确认' }),
    ).toBeVisible()
    await expect(page.getByRole('dialog').getByRole('button', { name: '查询结果' })).toBeVisible()
  })

  test('运行对账只读详情且没有重试或释放按钮', async ({ page }) => {
    await mockApi(page)
    await login(page)
    await page.getByRole('link', { name: '运行对账' }).click()
    await expect(page.getByText('供应商响应超时')).toBeVisible()
    await page.getByText('供应商响应超时').click()
    await expect(page.getByText('运行详情')).toBeVisible()
    await expect(page.getByRole('button', { name: '重试' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '释放' })).toHaveCount(0)
  })

  test('积分用户搜索后展示剩余可用与流水金额', async ({ page }) => {
    await mockApi(page)
    await login(page)
    await page.getByRole('link', { name: '积分用户' }).click()
    await page.getByPlaceholder('用户 ID 精确匹配或昵称前缀').fill('林')
    await page.getByRole('button', { name: '查询' }).click()
    await expect(page.getByText('林同学')).toBeVisible()
    await page.getByRole('button', { name: '查看' }).click()
    await expect(page.getByRole('columnheader', { name: '剩余可用' })).toBeVisible()
    await expect(page.getByRole('cell', { name: '95', exact: true })).toBeVisible()
    await page.getByRole('tab', { name: '积分流水' }).click()
    await expect(page.getByText('+100')).toBeVisible()
  })

  test('定价页开关先确认且不乐观翻转', async ({ page }) => {
    await mockApi(page)
    await login(page)
    await page.getByRole('link', { name: 'AI 定价与开关' }).click()
    await expect(page.getByText('配置版本 v8')).toBeVisible()
    await expect(page.getByText('价格版本 v3')).toBeVisible()
    const firstSwitch = page.locator('.ant-switch').first()
    await firstSwitch.click()
    await expect(page.getByText('确认修改服务开关')).toBeVisible()
    await expect(firstSwitch).toHaveClass(/ant-switch-checked/)
  })

  test('定价页展示服务商配置并可打开保存弹窗', async ({ page }) => {
    await mockApi(page)
    await login(page)
    await page.getByRole('link', { name: 'AI 定价与开关' }).click()
    await expect(page.getByText('服务商配置')).toBeVisible()
    await expect(page.getByText('已配置但未验证')).toBeVisible()
    await page.getByRole('button', { name: '更换配置', exact: true }).click()
    const modal = page.getByRole('dialog')
    await expect(modal.getByText('保存服务商配置')).toBeVisible()
    await expect(modal.getByText('测试可能产生少量服务商费用')).toBeVisible()
    await expect(modal.getByPlaceholder('请输入操作理由')).toBeVisible()
  })

  test('审计详情可复制 requestId', async ({ page }) => {
    await mockApi(page)
    await login(page)
    await page.getByRole('link', { name: '审计日志' }).click()
    await expect(page.getByText('新学期活动上线')).toBeVisible()
    await page.getByText('新学期活动上线').click()
    await expect(page.getByText('管理操作详情')).toBeVisible()
    await expect(page.getByText('req-9f3a')).toBeVisible()
  })

  test('角色页对 viewer 显示 403', async ({ page }) => {
    await mockApi(page, 'viewer')
    await login(page)
    await spaGoto(page, '/roles')
    await expect(page.getByText('403 无管理权限')).toBeVisible()
  })

  test('未知路由显示 404', async ({ page }) => {
    await mockApi(page)
    await login(page)
    await spaGoto(page, '/not-a-real-page')
    await expect(page.getByText('页面不存在')).toBeVisible()
  })
})
