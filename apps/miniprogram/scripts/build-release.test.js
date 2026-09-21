import { describe, expect, it } from 'vitest'
import { validateReleaseConfig } from './build-release.mjs'

describe('发布配置', () => {
  it('拒绝缺少真实应用标识的发布', () => {
    expect(() => validateReleaseConfig({})).toThrow('MINIPROGRAM_APP_ID')
  })
  it('拒绝回退默认云环境', () => {
    expect(() => validateReleaseConfig({ MINIPROGRAM_APP_ID: 'wx0123456789abcdef' })).toThrow(
      'MINIPROGRAM_CLOUD_ENV',
    )
  })
  it('接受显式绑定的应用和云环境', () => {
    expect(
      validateReleaseConfig({
        MINIPROGRAM_APP_ID: 'wx0123456789abcdef',
        MINIPROGRAM_CLOUD_ENV: 'production-test',
      }),
    ).toEqual({ appId: 'wx0123456789abcdef', cloudEnv: 'production-test' })
  })
})

it('发布产物绑定环境并移除预览且打包运行依赖', async () => {
  const { buildRelease } = await import('./build-release.mjs')
  const { readFileSync, existsSync, rmSync } = await import('node:fs')
  const output = buildRelease({
    MINIPROGRAM_APP_ID: 'wx0123456789abcdef',
    MINIPROGRAM_CLOUD_ENV: 'build-test-only',
  })
  try {
    const app = JSON.parse(readFileSync(`${output}/app.json`, 'utf8'))
    expect(app.pages).not.toContain('pages/capture-design/capture-design')
    expect(existsSync(`${output}/pages/capture-design`)).toBe(false)
    expect(existsSync(`${output}/app.ts`)).toBe(false)
    expect(existsSync(`${output}/app.js`)).toBe(true)
    expect(readFileSync(`${output}/constants/cloud.js`, 'utf8')).toContain('build-test-only')
    expect(readFileSync(`${output}/constants/build.js`, 'utf8')).toContain(
      'DESIGN_PREVIEW_ENABLED = false',
    )
    expect(readFileSync(`${output}/infrastructure/services/auth-service.js`, 'utf8')).not.toContain(
      'require("@studycommit/',
    )
    expect(existsSync(`${output}/shared/vendor.js`)).toBe(true)
    const { createRequire } = await import('node:module')
    const vendor = createRequire(import.meta.url)(`${output}/shared/vendor.js`)
    const auth = Object.values(vendor).find((entry) => entry.authTokensSchema)
    expect(auth.authTokensSchema.safeParse({}).success).toBe(false)
  } finally {
    rmSync(output, { recursive: true, force: true })
  }
})
