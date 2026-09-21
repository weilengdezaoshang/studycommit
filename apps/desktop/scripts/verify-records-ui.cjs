const { chromium, expect } = require('@playwright/test')
const { mkdir } = require('node:fs/promises')
const { resolve } = require('node:path')

// 使用真实构建的React页面与隔离IPC夹具；不会访问账户或服务端数据。
async function main() {
  const output = resolve(
    __dirname,
    '../../../docs/design/desktop-records-refinement-2026-09-16/implementation',
  )
  await mkdir(output, { recursive: true })
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      colorScheme: 'light',
    })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript(() => {
      const ok = (data) => ({ ok: true, data })
      const fail = () => ({
        ok: false,
        error: { code: 'NETWORK_ERROR', message: '网络暂不可用', status: null, details: null },
      })
      const titles = [
        '为什么做了笔记，还是会忘？\n今天看完了间隔重复的介绍。记下内容之后，还需要主动回忆，才能知道自己真正理解了什么。',
        'React 的状态是一张快照\n事件处理函数读取的是当次渲染的状态。',
        '把复杂问题拆成小问题\n先写出已知条件，再找出真正卡住的那一步。',
        'Safe Area 是内容的边界\n它决定内容与系统界面如何共处。',
        '用自己的话再讲一遍\n如果不能讲清楚，就回到概念和例子之间再走一次。',
      ]
      const papers = titles.map((content, index) => ({
        id: `paper-${index}`,
        content,
        contentDocument: null,
        status: 'organized',
        topicId: index === 1 ? 'frontend' : index === 3 ? 'mobile' : 'learning',
        version: 1,
        createdAt: `2026-09-${index < 3 ? '16' : '15'}T${['09:35', '11:20', '14:10', '20:10', '21:30'][index]}:00+08:00`,
        updatedAt: '2026-09-16T09:35:00+08:00',
        deletedAt: null,
        hasQuestion: index === 0 || index === 3,
        questionStatus: index === 0 || index === 3 ? 'thinking' : index === 2 ? 'resolved' : 'none',
        questionText: index === 0 ? '为什么反复阅读很熟悉，真正回忆时却想不起来？' : null,
        understandingText: index === 0 ? '熟悉不等于掌握。主动回忆能暴露理解中的空缺。' : null,
        questionResolvedAt: null,
        assets: [],
      }))
      const topics = [
        { id: 'learning', name: '学习方法' },
        { id: 'frontend', name: '前端开发' },
        { id: 'mobile', name: '移动端设计' },
      ].map((value) => ({ ...value, color: '#4A6388', version: 1 }))
      localStorage.setItem(
        'studycommit.desktop.auth.session.v1',
        JSON.stringify({
          user: { id: 'visual-test', nickname: '设计验收', avatarUrl: null, status: 'active' },
        }),
      )
      window.__recordScenario = new URLSearchParams(location.search).get('scenario') || 'normal'
      window.studyCommit = {
        platform: 'darwin',
        auth: { getSession: async () => ok(null) },
        capture: {
          onRequestResult: () => () => {},
          request: async () => ok({ status: 'permission-denied' }),
          permissionCheck: async () => ok('denied'),
          openPermissionSettings: async () => ok(null),
        },
        studySessions: {
          getActive: async () =>
            ok({ session: null, paper: null, serverNow: new Date().toISOString() }),
          pendingFragmentCount: async () => ok(0),
        },
        topics: {
          listActive: async () =>
            ok({ items: topics, pageInfo: { hasNextPage: false, nextCursor: null } }),
        },
        learningLogs: { list: async () => ok({ items: [], pageInfo: { hasNextPage: false } }) },
        papers: {
          list: async () =>
            window.__recordScenario === 'list-failure'
              ? fail()
              : ok({
                  items: window.__recordScenario === 'empty' ? [] : papers,
                  pageInfo: { hasNextPage: false, nextCursor: null },
                }),
          get: async (id) => ok(papers.find((paper) => paper.id === id)),
          knowledge: async () =>
            window.__recordScenario === 'detail-failure'
              ? fail()
              : ok({
                  additions: [],
                  relations: [],
                  additionsHasMore: false,
                  relationsHasMore: false,
                }),
          create: async (input, options) => {
            if (window.__recordScenario === 'save-failure') return fail()
            const saved = {
              ...papers[0],
              ...input,
              id: options?.idempotencyKey ?? 'new',
              createdAt: new Date().toISOString(),
            }
            if (!papers.some((paper) => paper.id === saved.id)) papers.unshift(saved)
            return ok(saved)
          },
          assetAccess: async () => fail(),
          organize: async (input) => ok({ ...papers[0], topicId: input.topicId }),
          question: async () => fail(),
        },
      }
    })
    await page.goto('http://127.0.0.1:5173/#/timeline')
    await expect(page.getByText('全部记录 · 5 条记录')).toBeVisible()
    if (process.argv.includes('--dev-api')) {
      await page.evaluate(() => {
        const data = {
          protocol: 'openai',
          baseUrl: 'https://example.com/v1',
          model: 'test-model',
          hasApiKey: true,
          timeoutMs: 60000,
        }
        window.studyCommit.devAiSettings = {
          read: async () => ({ ok: true, data }),
          save: async (input) => {
            Object.assign(data, {
              protocol: input.protocol,
              baseUrl: input.baseUrl,
              model: input.model,
            })
            return { ok: true, data }
          },
          remove: async () => {
            data.hasApiKey = false
            return { ok: true, data }
          },
        }
      })
      await page.goto('http://127.0.0.1:5173/#/settings')
      await expect(page.getByRole('region', { name: '开发 API 配置' })).toBeVisible()
      await expect(page.getByLabel('API 密钥', { exact: true })).toHaveValue('')
      await page.getByRole('button', { name: '保存 API 配置' }).click()
      await expect(page.getByText(/已保存到 macOS 钥匙串/)).toBeVisible()
      await page
        .getByRole('region', { name: '开发 API 配置' })
        .screenshot({ path: resolve(output, '35-dev-api-settings.png') })
      if (errors.length) throw new Error(errors.join('\n'))
      console.log(
        '通过：开发 API 设置表单、已存密钥不回显、保存反馈。使用隔离 IPC，不访问真实配置。',
      )
      return
    }
    if (process.argv.includes('--drawer')) {
      await page.getByRole('button', { name: '打开我的抽屉' }).click()
      const drawer = page.locator('#study-drawer')
      await expect(drawer).toBeVisible()
      await expect.poll(async () => Math.abs((await drawer.boundingBox()).x)).toBeLessThan(1)
      await page.evaluate(() => document.fonts.ready)
      const date = drawer.locator('.calendar-cell:not(.calendar-cell--blank)').first()
      const rect = await date.boundingBox()
      if (!rect || Math.abs(rect.width - rect.height) > 1) throw new Error('日期不是方形')
      await expect(date).toHaveCSS('background-image', 'none')
      await page.screenshot({ path: resolve(output, '33-notebook-drawer.png') })
      const yearSelect = drawer.getByRole('combobox', { name: '选择年份' })
      await yearSelect.click()
      await expect(page.locator('.dropdown-select-menu')).toBeInViewport()
      await page.screenshot({ path: resolve(output, '34-calendar-shared-select.png') })
      await page.keyboard.press('Escape')
      await expect(drawer).toHaveAttribute('aria-hidden', 'false')
      await drawer.getByRole('combobox', { name: '选择月份' }).click()
      await page.getByRole('option', { name: '8 月', exact: true }).click()
      await expect(drawer.getByRole('combobox', { name: '选择月份' })).toHaveText('8 月')
      await drawer.getByRole('combobox', { name: '选择月份' }).click()
      await page.getByRole('option', { name: '9 月', exact: true }).click()
      await drawer.getByRole('button', { name: '颜色含义说明' }).click()
      await expect(drawer.getByRole('note')).toContainText('日期下方显示当天记录条数')
      await expect(drawer.locator('.calendar-record-count').filter({ hasText: '3条' })).toHaveCount(
        1,
      )
      await expect(drawer.locator('.calendar-record-count').filter({ hasText: '2条' })).toHaveCount(
        1,
      )
      await page.setViewportSize({ width: 900, height: 600 })
      await expect(drawer.getByRole('button', { name: '上一个月' })).toBeInViewport()
      await drawer.getByRole('button', { name: '上一个月' }).click()
      await expect(drawer.getByRole('note')).toHaveCount(0)
      await drawer.getByRole('button', { name: '下一个月' }).click()
      await date.click()
      await expect(drawer).toHaveAttribute('aria-hidden', 'true')
      if (errors.length) throw new Error(errors.join('\n'))
      console.log('通过：抽屉方形日期、无斜纹、图例、切月、选择日期及窄窗口。')
      return
    }
    if (process.argv.includes('--header')) {
      const header = page.getByRole('banner')
      await expect(header.getByRole('status')).toBeVisible()
      await expect(header.getByLabel('个人设置')).toHaveCount(0)
      await expect(header).toHaveCSS('position', 'fixed')
      await page.mouse.wheel(0, 700)
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
      await expect(header).toBeInViewport()
      const box = await header.boundingBox()
      if (!box || Math.abs(box.y) > 1) throw new Error('顶栏没有固定在窗口顶部')
      await page.screenshot({ path: resolve(output, '32-fixed-header.png') })
      await page.setViewportSize({ width: 900, height: 600 })
      await expect(header.getByRole('status')).toBeInViewport()
      console.log('通过：同步状态回到右侧，滚动后白栏保持固定，窄窗口仍可见。')
      return
    }
    if (process.argv.includes('--search')) {
      await page.evaluate(() => {
        window.studyCommit.search = {
          query: async () => ({
            ok: true,
            data: {
              papers: { items: [], pageInfo: { hasNextPage: false, nextCursor: null } },
              topics: [],
            },
          }),
        }
      })
      await page.goto('http://127.0.0.1:5173/#/search')
      await expect(page.getByRole('heading', { name: '找回一点想法' })).toBeVisible()
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({ path: resolve(output, '25-search-initial.png') })
      const input = page.getByLabel('搜索记录', { exact: true })
      await input.fill('理解')
      await expect(page.getByRole('heading', { name: /找到的记录/ })).toBeVisible()
      await expect(page.getByText('正在搜索云端记录，本机结果先显示…')).toHaveCount(0)
      await page.screenshot({ path: resolve(output, '26-search-results.png') })
      await expect(page.locator('.search-field__row')).toHaveCSS('outline-style', 'none')
      const resultLink = page.locator('.search-card__link').first()
      await resultLink.hover()
      await page.screenshot({ path: resolve(output, '30-search-card-hover.png') })
      await input.focus()
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')
      await expect(resultLink).toBeFocused()
      await expect(resultLink).toHaveCSS('outline-style', 'none')
      await page.mouse.move(0, 0)
      await page.screenshot({ path: resolve(output, '31-search-card-focus.png') })
      await input.fill('不存在的关键词')
      await expect(page.getByText('这次还没翻到')).toBeVisible()
      await page.screenshot({ path: resolve(output, '27-search-empty.png') })
      await page.evaluate(() => {
        window.studyCommit.search.query = async () => {
          throw new Error('offline')
        }
      })
      await input.fill('无网络')
      await expect(page.getByText('本机暂时没有找到')).toBeVisible()
      await page.screenshot({ path: resolve(output, '28-search-offline.png') })
      await page.setViewportSize({ width: 800, height: 620 })
      await page.getByRole('button', { name: '清除关键词', exact: true }).click()
      await page.evaluate(() => window.scrollTo(0, 0))
      await expect(input).toBeInViewport()
      const inputBox = await input.boundingBox()
      if (!inputBox || inputBox.width < 400) throw new Error('窄窗口搜索框被挤压')
      await page.screenshot({ path: resolve(output, '29-search-narrow.png') })
      if (errors.length) throw new Error(errors.join('\n'))
      console.log('通过：搜索初始、结果、无结果、离线回退、清空与窄窗口显示。')
      return
    }
    if (process.argv.includes('--toolbar')) {
      await page.evaluate(() => document.fonts.ready)
      const status = page.getByRole('combobox', { name: '记录状态' })
      const order = page.getByRole('combobox', { name: '时间顺序' })
      await status.click()
      await expect(page.getByRole('listbox')).toBeVisible()
      await page.screenshot({ path: resolve(output, '23-shared-dropdown.png') })
      await page.getByRole('option', { name: '还在思考' }).click()
      await expect(status).toHaveText('还在思考')
      await status.click()
      await page.getByRole('option', { name: '全部状态' }).click()
      await order.click()
      await page.getByRole('option', { name: '最早在前' }).click()
      await expect(order).toHaveText('最早在前')
      await order.click()
      await page.getByRole('option', { name: '最近在前' }).click()
      await page.screenshot({ path: resolve(output, '21-home-handdrawn-toolbar.png') })
      await page.setViewportSize({ width: 900, height: 600 })
      await expect(page.getByRole('button', { name: '＋ 记一点' })).toBeInViewport()
      await expect(status).toBeInViewport()
      await expect(order).toBeInViewport()
      await status.focus()
      await expect(status).toBeFocused()
      await page.keyboard.press('ArrowDown')
      await expect(page.getByRole('listbox')).toBeInViewport()
      await page.keyboard.press('Escape')
      await expect(page.getByRole('listbox')).toHaveCount(0)
      await page.screenshot({ path: resolve(output, '22-home-toolbar-narrow.png') })
      if (errors.length) throw new Error(errors.join('\n'))
      await status.evaluate((element) => {
        element.parentElement.style.position = 'fixed'
        element.parentElement.style.bottom = '8px'
        element.parentElement.style.right = '8px'
        element.parentElement.style.zIndex = '50'
      })
      await status.click()
      await expect(page.locator('.dropdown-select-menu')).toHaveAttribute('data-placement', 'top')
      await expect(page.getByRole('listbox')).toBeInViewport()
      await page.screenshot({ path: resolve(output, '24-dropdown-edge-position.png') })
      await page.keyboard.press('Escape')
      await page.reload()
      await page.getByRole('button', { name: '＋ 记一点' }).click()
      const format = page.getByRole('combobox', { name: '段落格式' })
      await format.click()
      await expect(page.getByRole('listbox')).toBeInViewport()
      await page.keyboard.press('Escape')
      await expect(format).toBeVisible()
      await format.click()
      await page.getByRole('option', { name: '标题 1', exact: true }).click()
      await expect(format).toHaveText('标题 1')
      if (errors.length) throw new Error(errors.join('\n'))
      console.log('通过：公共手绘下拉、筛选与排序、键盘关闭、窄窗口和底部向上避让。')
      return
    }
    await page.screenshot({ path: resolve(output, '01-home.png') })
    await page.setViewportSize({ width: 1585, height: 992 })
    await page.screenshot({ path: resolve(output, '01-home-reference-size.png') })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.getByRole('button', { name: /打开记录：为什么做了笔记/ }).click()
    await expect(page.getByText('整理这条记录')).toBeVisible()
    await expect(page.locator('.secondary-detail')).toHaveCSS('opacity', '1')
    await page.screenshot({ path: resolve(output, '02-detail.png') })
    await page.getByRole('link', { name: '← 返回记录本' }).click()
    await page.getByRole('button', { name: '＋ 记一点' }).click()
    const dialog = page.getByRole('dialog', { name: '记一点', exact: true })
    await expect(dialog.getByRole('button', { name: '保存记录' })).toBeDisabled()
    const editor = dialog.getByRole('textbox', { name: '正文', exact: true })
    await editor.fill('今天学到的一点\n记录不是把内容搬进笔记，而是给未来的自己留一条线索。')
    await expect(dialog.getByRole('button', { name: '保存记录' })).toBeEnabled()
    await page.screenshot({ path: resolve(output, '03-compose.png') })
    await page.evaluate(() => {
      window.__recordScenario = 'save-failure'
    })
    await dialog.getByRole('button', { name: '保存记录' }).click()
    await expect(dialog.getByRole('alert')).toContainText('保存失败')
    await expect(editor).toContainText('今天学到的一点')
    await page.screenshot({ path: resolve(output, '04-save-failure.png') })
    await editor.fill('文'.repeat(20001))
    await expect(dialog.getByRole('button', { name: '重试保存' })).toBeDisabled()
    await expect(dialog.getByText('正文已超出 1 字，请精简后保存。')).toBeVisible()
    await page.screenshot({ path: resolve(output, '05-overflow.png') })
    await editor.fill('可保存的内容')
    await page.setViewportSize({ width: 900, height: 600 })
    await expect(dialog.getByRole('button', { name: '重试保存' })).toBeInViewport()
    const bounds = await dialog.boundingBox()
    if (
      !bounds ||
      bounds.x < 0 ||
      bounds.y < 0 ||
      bounds.x + bounds.width > 900 ||
      bounds.y + bounds.height > 600
    ) {
      throw new Error('小窗口弹窗边界超出视口')
    }
    await page.screenshot({ path: resolve(output, '06-narrow.png') })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
    if (overflow) throw new Error('窄窗口出现整页横向溢出')
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('http://127.0.0.1:4178/?scenario=empty#/timeline')
    await expect(page.getByRole('heading', { name: '记录本还是空的' })).toBeVisible()
    await page.screenshot({ path: resolve(output, '07-empty.png') })
    await page.goto('http://127.0.0.1:4178/?scenario=list-failure#/timeline')
    await expect(page.getByRole('heading', { name: '记录暂时加载失败' })).toBeVisible()
    await page.screenshot({ path: resolve(output, '08-load-failure.png') })
    if (errors.length) throw new Error(errors.join('\n'))
    console.log(
      '通过：首页、详情、弹窗、空输入、保存失败保留正文、超限禁用、900×600布局；截图：' + output,
    )
  } finally {
    await browser.close()
  }
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
