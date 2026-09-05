import type { ApiOrpcClient } from './client'
import { callOrpc } from './errors'
import type { UploadsApi } from '../../ports'

/** 图片直传会话的 oRPC 适配:契约即端口,无额外映射。 */
export function createOrpcUploadsService(client: ApiOrpcClient): UploadsApi {
  return {
    create: (input) => callOrpc(() => client.uploads.create(input, { context: {} })),
    complete: (uploadId) => callOrpc(() => client.uploads.complete({ uploadId }, { context: {} })),
    remove: async (uploadId) => {
      await callOrpc(() => client.uploads.remove({ uploadId }, { context: {} }))
    },
    access: (assetId) => callOrpc(() => client.uploads.access({ id: assetId }, { context: {} })),
  }
}
