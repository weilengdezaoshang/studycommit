import type { AssetKind, AssetMimeType } from '@studycommit/rpc-contracts/uploads'

/**
 * 上传会话运行时(SH-304):断点续传判定的纯函数。
 * 同一文件(sha256 + 大小 + 类型一致)在会话过期前复用未完成的直传会话,
 * 避免重复占用 pending 配额;过期会话由服务端清理任务兜底删除。
 */

export type UploadSessionStatus = 'pending' | 'uploaded' | 'attached' | 'deleted'

export interface UploadSessionRef {
  uploadId: string
  kind: AssetKind
  mimeType: AssetMimeType
  sizeBytes: number
  sha256: string
  status: UploadSessionStatus
  /** 会话过期时间(毫秒时间戳),过期后不得再复用 */
  expiresAt: number
}

export interface UploadFileFingerprint {
  kind: AssetKind
  mimeType: AssetMimeType
  sizeBytes: number
  sha256: string
}

export function isUploadSessionExpired(session: UploadSessionRef, now: number): boolean {
  return session.expiresAt <= now
}

/**
 * 从已有会话中找出可复用的未完成直传会话:
 * 指纹(sha256+size+kind+mime)一致、仍为 pending 且未过期才可续传。
 */
export function findReusableUploadSession(
  sessions: readonly UploadSessionRef[],
  file: UploadFileFingerprint,
  now: number,
): UploadSessionRef | null {
  for (const session of sessions) {
    if (session.status !== 'pending' || isUploadSessionExpired(session, now)) {
      continue
    }
    if (
      session.sha256 === file.sha256 &&
      session.sizeBytes === file.sizeBytes &&
      session.kind === file.kind &&
      session.mimeType === file.mimeType
    ) {
      return session
    }
  }
  return null
}
