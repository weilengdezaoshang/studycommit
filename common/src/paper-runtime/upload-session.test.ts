import { describe, expect, it } from 'vitest'
import {
  findReusableUploadSession,
  isUploadSessionExpired,
  type UploadSessionRef,
} from './upload-session'

const NOW = 1_000_000

function sessionWith(overrides: Partial<UploadSessionRef> = {}): UploadSessionRef {
  return {
    uploadId: '5e1c8a2b-3f4d-4a5b-8c9d-0e1f2a3b4c5d',
    kind: 'image',
    mimeType: 'image/jpeg',
    sizeBytes: 102_400,
    sha256: 'a'.repeat(64),
    status: 'pending',
    expiresAt: NOW + 60_000,
    ...overrides,
  }
}

describe('isUploadSessionExpired', () => {
  it('过期时间早于当前时间判定为已过期', () => {
    expect(isUploadSessionExpired(sessionWith({ expiresAt: NOW - 1 }), NOW)).toBe(true)
  })

  it('过期时间晚于当前时间判定为未过期', () => {
    expect(isUploadSessionExpired(sessionWith(), NOW)).toBe(false)
  })
})

describe('findReusableUploadSession', () => {
  it('同一文件在会话过期前复用 pending 会话实现断点续传', () => {
    const existing = sessionWith()
    const reused = findReusableUploadSession(
      [existing],
      { kind: 'image', mimeType: 'image/jpeg', sizeBytes: 102_400, sha256: 'a'.repeat(64) },
      NOW,
    )
    expect(reused?.uploadId).toBe(existing.uploadId)
  })

  it('文件指纹不同时不复用', () => {
    const reused = findReusableUploadSession(
      [sessionWith()],
      { kind: 'image', mimeType: 'image/jpeg', sizeBytes: 102_400, sha256: 'b'.repeat(64) },
      NOW,
    )
    expect(reused).toBeNull()
  })

  it('已完成的会话不再复用', () => {
    const reused = findReusableUploadSession(
      [sessionWith({ status: 'uploaded' })],
      { kind: 'image', mimeType: 'image/jpeg', sizeBytes: 102_400, sha256: 'a'.repeat(64) },
      NOW,
    )
    expect(reused).toBeNull()
  })

  it('已过期的会话不再复用', () => {
    const reused = findReusableUploadSession(
      [sessionWith({ expiresAt: NOW - 1 })],
      { kind: 'image', mimeType: 'image/jpeg', sizeBytes: 102_400, sha256: 'a'.repeat(64) },
      NOW,
    )
    expect(reused).toBeNull()
  })
})
