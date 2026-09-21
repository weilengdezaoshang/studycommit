import { afterEach, expect, it, vi } from 'vitest'
import { resolveLocalBackendMode } from './service-context'

afterEach(() => vi.unstubAllGlobals())

it('正式版忽略本地调试覆盖并使用云函数', () => {
  vi.stubGlobal('wx', {
    getAccountInfoSync: () => ({ miniProgram: { envVersion: 'release' } }),
    getStorageSync: () => 'http',
  })
  expect(resolveLocalBackendMode()).toBe('cloud-function')
})

it('开发版仍允许显式切换传输方式', () => {
  vi.stubGlobal('wx', {
    getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
    getStorageSync: () => 'http',
  })
  expect(resolveLocalBackendMode()).toBe('http')
})
