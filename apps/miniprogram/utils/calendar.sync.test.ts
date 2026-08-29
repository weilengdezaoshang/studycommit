import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/*
 * 小程序运行时无法解析工作区包,utils/calendar.ts 是
 * common/src/study-session-runtime/calendar.ts 的运行时镜像副本。
 * 本测试强制两份文件保持一致:修改任一侧后必须同步另一侧。
 */

const runtimeCopy = resolve(import.meta.dirname, 'calendar.ts')
const canonicalSource = resolve(
  import.meta.dirname,
  '../../../common/src/study-session-runtime/calendar.ts',
)

describe('calendar 镜像副本同步', () => {
  it('小程序运行时副本与 common 唯一源保持一致', () => {
    const runtime = readFileSync(runtimeCopy, 'utf8')
    const canonical = readFileSync(canonicalSource, 'utf8')
    expect(runtime).toBe(canonical)
  })
})
