import type {
  AssetAccessOutput,
  AssetKind,
  AssetMimeType,
  CompleteUploadOutput,
  CreateUploadOutput,
} from '@studycommit/rpc-contracts/uploads'

/** 图片直传会话(BE-308):服务器不过二进制,客户端 PUT 签名地址。 */
export interface UploadsApi {
  create(input: {
    uploadId: string
    kind: AssetKind
    mimeType: AssetMimeType
    sizeBytes: number
    sha256: string
  }): Promise<CreateUploadOutput>
  complete(uploadId: string): Promise<CompleteUploadOutput>
  /** 用户取消或删除图片:清理对象与记录,不留 pending 残留 */
  remove(uploadId: string): Promise<void>
  /** 换取私有资源短时访问地址,渲染图片前调用 */
  access(assetId: string): Promise<AssetAccessOutput>
}

export type {
  AssetAccessOutput,
  AssetKind,
  AssetMimeType,
  CompleteUploadOutput,
  CreateUploadOutput,
}
