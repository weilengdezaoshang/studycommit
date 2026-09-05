/**
 * 纸页共享 React Hook(SH-305):移动端与桌面端共用的草稿恢复与图片直传。
 * 平台差异(本地存储、前后台订阅、文件读取与哈希)一律通过参数注入,
 * Hook 内不出现 React Native / Electron / DOM 依赖。
 */
export { PAPER_DRAFT_SAVE_ERROR, useRecoverableDraft } from './use-recoverable-draft'
export type {
  PaperDraftStorage,
  RecoverableDraftController,
  UseRecoverableDraftOptions,
} from './use-recoverable-draft'
export { ASSET_UPLOAD_ERROR, useAssetUpload } from './use-asset-upload'
export type {
  AssetPutFileRequest,
  AssetUploadController,
  AssetUploadFileInput,
  AssetUploadItem,
  UseAssetUploadOptions,
} from './use-asset-upload'
export type { PaperDraft, PaperDraftAction } from '../paper-runtime'
