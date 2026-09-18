import { expect, test } from '@playwright/test'
import {
  creditUserDetail,
  creditUsers,
  IDS,
  loginResponse,
  meSuperAdmin,
  overview,
} from './fixtures'

test('切换积分用户后请求失败不会显示上一位用户的余额与批次', async ({ page }) => {
  const otherId = '77777777-7777-4777-8777-777777777777'
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
    if (path === '/api/admin/credits/users') {
return route.fulfill({
        json: {
          items: [
            creditUsers.items[0],
            { ...creditUsers.items[0], userId: otherId, nickname: '另一位用户' },
          ],
        },
      })
}
    if (path.endsWith(IDS.user)) {
return route.fulfill({ json: creditUserDetail })
}
    if (path.endsWith(otherId)) {
return route.fulfill({
        status: 500,
        json: { code: 'SERVER_ERROR', message: '详情暂时不可用' },
      })
}
    return route.fulfill({ json: { items: [], nextCursor: null } })
  })
  await page.goto('/login')
  await page.getByLabel('账号', { exact: true }).fill('admin')
  await page.getByLabel('密码', { exact: true }).fill('password123')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await page.locator('a[href="/credits"]').first().click()
  await page.getByPlaceholder('用户 ID 精确匹配或昵称前缀').fill('用户')
  await page.getByRole('button', { name: '查询', exact: true }).click()
  await page.getByRole('button', { name: '查看', exact: true }).first().click()
  const drawer = page.getByRole('dialog')
  await expect(drawer.getByText('林同学', { exact: true })).toBeVisible()
  await drawer
    .getByRole('button', { name: /关闭|Close/ })
    .first()
    .click()
  await page.getByRole('button', { name: '查看', exact: true }).nth(1).click()
  await expect(drawer.getByText('详情暂时不可用', { exact: true })).toBeVisible()
  await expect(drawer.getByText('林同学', { exact: true })).toHaveCount(0)
})
