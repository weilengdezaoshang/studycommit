// @vitest-environment node
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CaptureRegistry } from './capture-registry'

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

describe('CaptureRegistry', () => {
  it('保存截图写入 PNG 文件并返回唯一 captureId', async () => {
    const root = await mkdtemp(join(tmpdir(), 'studycommit-capture-'))
    try {
      const registry = new CaptureRegistry(root)
      const saved = await registry.save(PNG_BYTES, 800, 600)
      expect(saved).toMatchObject({ width: 800, height: 600 })
      expect(saved.filePath.startsWith(root)).toBe(true)
      expect(existsSync(saved.filePath)).toBe(true)
      expect((await readFile(saved.filePath)).subarray(0, 4)).toEqual(PNG_BYTES.subarray(0, 4))
      expect(registry.size).toBe(1)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('确认后保留文件供保存流程消费', async () => {
    const root = await mkdtemp(join(tmpdir(), 'studycommit-capture-'))
    try {
      const registry = new CaptureRegistry(root)
      const saved = await registry.save(PNG_BYTES, 800, 600)
      const confirmed = registry.confirm(saved.captureId)
      expect(confirmed).toMatchObject({ captureId: saved.captureId, filePath: saved.filePath })
      expect(existsSync(saved.filePath)).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('取消时立即删除临时文件', async () => {
    const root = await mkdtemp(join(tmpdir(), 'studycommit-capture-'))
    try {
      const registry = new CaptureRegistry(root)
      const saved = await registry.save(PNG_BYTES, 800, 600)
      await expect(registry.cancel(saved.captureId)).resolves.toBe(true)
      expect(existsSync(saved.filePath)).toBe(false)
      expect(registry.size).toBe(0)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('未知 captureId 的确认与取消安全返回空', async () => {
    const root = await mkdtemp(join(tmpdir(), 'studycommit-capture-'))
    try {
      const registry = new CaptureRegistry(root)
      expect(registry.confirm('2f0c9d92-58a2-4c6e-9f7a-1d1c2b3a4e5f')).toBeNull()
      await expect(registry.cancel('2f0c9d92-58a2-4c6e-9f7a-1d1c2b3a4e5f')).resolves.toBe(false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('退出时清空注册表全部临时文件', async () => {
    const root = await mkdtemp(join(tmpdir(), 'studycommit-capture-'))
    try {
      const registry = new CaptureRegistry(root)
      const first = await registry.save(PNG_BYTES, 100, 100)
      const second = await registry.save(PNG_BYTES, 200, 200)
      await registry.disposeAll()
      expect(existsSync(first.filePath)).toBe(false)
      expect(existsSync(second.filePath)).toBe(false)
      expect(registry.size).toBe(0)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
