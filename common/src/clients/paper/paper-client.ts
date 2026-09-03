import {
  createPaperInputSchema,
  listPapersInputSchema,
  organizePaperInputSchema,
  paperCommandSchema,
  paperPageSchema,
  paperSchema,
  updatePaperInputSchema,
  deletePaperOutputSchema,
  type CreatePaperInput,
  type DeletePaperOutput,
  type ListPapersInput,
  type OrganizePaperInput,
  type Paper,
  type PaperCommandInput,
  type PaperPage,
  type UpdatePaperInput,
} from '../../contracts/paper'
import type { HttpTransport } from '../../http'
import type { PaperApi } from '../../ports'

export type { PaperApi } from '../../ports'

/** 纸页客户端:对齐后端 papers.controller 的 REST 路径。 */
export class PaperClient implements PaperApi {
  constructor(private readonly http: HttpTransport) {}

  list(input?: ListPapersInput): Promise<PaperPage> {
    const query = listPapersInputSchema.parse(input ?? { limit: 20 })
    const params = new URLSearchParams({ limit: String(query.limit) })
    if (query.status) {
      params.set('status', query.status)
    }
    if (query.topicId) {
      params.set('topicId', query.topicId)
    }
    if (query.cursor) {
      params.set('cursor', query.cursor)
    }
    return this.http.request({
      method: 'GET',
      path: `/papers?${params.toString()}`,
      responseSchema: paperPageSchema,
    })
  }

  create(input: CreatePaperInput): Promise<Paper> {
    return this.http.request({
      method: 'POST',
      path: '/papers',
      body: createPaperInputSchema.parse(input),
      responseSchema: paperSchema,
    })
  }

  update(input: UpdatePaperInput): Promise<Paper> {
    return this.http.request({
      method: 'PATCH',
      path: `/papers/${input.id}`,
      body: updatePaperInputSchema.parse(input),
      responseSchema: paperSchema,
    })
  }

  organize(input: OrganizePaperInput): Promise<Paper> {
    return this.http.request({
      method: 'POST',
      path: `/papers/${input.id}/organize`,
      body: organizePaperInputSchema.parse(input),
      responseSchema: paperSchema,
    })
  }

  moveToInbox(input: PaperCommandInput): Promise<Paper> {
    return this.http.request({
      method: 'POST',
      path: `/papers/${input.id}/move-to-inbox`,
      body: paperCommandSchema.parse(input),
      responseSchema: paperSchema,
    })
  }

  remove(input: PaperCommandInput): Promise<DeletePaperOutput> {
    return this.http.request({
      method: 'DELETE',
      path: `/papers/${input.id}`,
      body: paperCommandSchema.parse(input),
      responseSchema: deletePaperOutputSchema,
    })
  }
}
