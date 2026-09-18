import { homedir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { getEnvFiles } from './env-files'

describe('getEnvFiles', () => {
  it('默认优先读取工作区外的用户配置', () => {
    expect(getEnvFiles({})).toEqual([
      join(homedir(), '.config', 'studycommit', 'api.env'),
      '.env.local',
      '.env',
    ])
  })
  it('支持指定外部配置绝对路径', () => {
    expect(getEnvFiles({ STUDYCOMMIT_CONFIG_FILE: '/tmp/studycommit/api.env' })[0]).toBe(
      '/tmp/studycommit/api.env',
    )
  })
  it('测试环境不读取私人配置', () => {
    expect(getEnvFiles({ NODE_ENV: 'test', STUDYCOMMIT_CONFIG_FILE: '/tmp/private.env' })).toEqual([
      '.env.test.local',
      '.env.test',
    ])
  })
  it('拒绝相对路径以避免配置位置不明确', () => {
    expect(() => getEnvFiles({ STUDYCOMMIT_CONFIG_FILE: 'api.env' })).toThrow('必须使用绝对路径')
  })
})
