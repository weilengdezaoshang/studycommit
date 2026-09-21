import { captureImageVersionKey, type CaptureSavePort } from '@studycommit/common/capture-runtime'
import type { MobileServices } from '../http/create-mobile-services'
import { putLocalFile, sha256OfLocalFile, sizeOfLocalFile } from '../media/image-upload'

export function createMobileCaptureSavePort(
  services: Pick<MobileServices, 'uploads' | 'papers'>,
  createId: () => string,
): CaptureSavePort {
  return {
    async save(input, onProgress, onUploadReserved) {
      const uploadIds: string[] = []
      for (const [index, image] of input.images.entries()) {
        const versionKey = captureImageVersionKey(image)
        const uploadId = input.uploadsByImageVersion[versionKey] ?? image.uploadId ?? createId()
        if (!input.uploadsByImageVersion[versionKey]) {
          await onUploadReserved({ imageId: image.id, version: image.version, uploadId })
        }
        const session = await services.uploads.create({
          uploadId,
          kind: 'image',
          mimeType: image.mimeType ?? 'image/jpeg',
          sizeBytes: image.sizeBytes ?? sizeOfLocalFile(image.uri),
          sha256: await sha256OfLocalFile(image.uri),
        })
        await putLocalFile({
          uploadUrl: session.uploadUrl,
          headers: session.headers,
          localUri: image.uri,
          mimeType: image.mimeType ?? 'image/jpeg',
        })
        await services.uploads.complete(session.uploadId)
        uploadIds.push(session.uploadId)
        onProgress(index + 1)
      }
      const paper = await services.papers.create(
        {
          content: input.content.trim(),
          hasQuestion: input.question,
          assetUploadIds: uploadIds,
        },
        { idempotencyKey: input.idempotencyKey },
      )
      return { id: paper.id }
    },
  }
}
