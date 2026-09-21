/**
 * 纸页契约以 rpc-contracts 为单一来源。common 再导出，避免桌面 IPC 与 API 各持一份。
 */
export {
  paperStatusSchema,
  paperQuestionStatusSchema,
  paperSchema,
  createPaperInputSchema,
  listPapersInputSchema,
  paperPageSchema,
  paperCommandSchema,
  updatePaperInputSchema,
  updatePaperQuestionInputSchema,
  organizePaperInputSchema,
  deletePaperOutputSchema,
} from '@studycommit/rpc-contracts/papers'
export type {
  Paper,
  PaperPage,
  CreatePaperInput,
  ListPapersInput,
  UpdatePaperInput,
  OrganizePaperInput,
  PaperCommandInput,
  UpdatePaperQuestionInput,
  PaperQuestionStatus,
  DeletePaperOutput,
} from '@studycommit/rpc-contracts/papers'
