import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCaptureState } from '../shared/capture-runtime/index'
import { clearCaptureDraft, saveCaptureDraft } from './capture-draft'
const session = vi.hoisted(() => ({ id: 'A' }))
vi.mock('./auth-session', () => ({ getStoredSession: () => ({ user: { id: session.id } }) }))
const records = new Map<string, string>()
let finishCopy: (value: { savedFilePath: string }) => void
beforeEach(() => {
  session.id = 'A'
  records.clear()
  vi.stubGlobal('wx', {
    env: { USER_DATA_PATH: '/user' },
    getStorageSync: (key: string) => records.get(key),
    setStorageSync: (key: string, value: string) => records.set(key, value),
    removeStorageSync: (key: string) => records.delete(key),
    getFileSystemManager: () => ({
      saveFile: ({ success }: { success: typeof finishCopy }) => {
        finishCopy = success
      },
      unlink: vi.fn(),
    }),
  })
})
const draft = () => ({
  ...createCaptureState(),
  content: '账号 A 的草稿',
  images: [{ id: 'image', version: 1, uri: '/temp/a.jpg', text: '', status: 'waiting' as const }],
})
const tick = async () => {
  await Promise.resolve()
  await Promise.resolve()
}
describe('小程序草稿账号隔离', () => {
  it('复制图片期间切换账号仍写入原账号且不阻塞新账号', async () => {
    const saving = saveCaptureDraft(draft())
    await tick()
    session.id = 'B'
    await saveCaptureDraft({ ...createCaptureState(), content: '账号 B 的草稿' })
    finishCopy({ savedFilePath: '/user/a.jpg' })
    await saving
    expect(JSON.parse(records.get('studycommit.capture.draft.v1:A')!).content).toBe('账号 A 的草稿')
    expect(JSON.parse(records.get('studycommit.capture.draft.v1:B')!).content).toBe('账号 B 的草稿')
  })
  it('等待保存完成的清理只删除调用时的账号草稿', async () => {
    const saving = saveCaptureDraft(draft())
    const clearing = clearCaptureDraft()
    await tick()
    session.id = 'B'
    await saveCaptureDraft({ ...createCaptureState(), content: '保留 B' })
    finishCopy({ savedFilePath: '/user/a.jpg' })
    await saving
    await clearing
    expect(records.has('studycommit.capture.draft.v1:A')).toBe(false)
    expect(JSON.parse(records.get('studycommit.capture.draft.v1:B')!).content).toBe('保留 B')
  })
})
