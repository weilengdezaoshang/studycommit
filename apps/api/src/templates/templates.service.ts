import { Inject, Injectable } from '@nestjs/common'
import type { Template as TemplateDto } from '@studycommit/rpc-contracts/templates'
import { TemplatesRepository, type Template } from './templates.repository'

@Injectable()
export class TemplatesService {
  constructor(@Inject(TemplatesRepository) private readonly repository: TemplatesRepository) {}

  async list(userId: string) {
    const items = await this.repository.list(userId)
    return { items: items.map((template) => this.toTemplate(template)) }
  }

  private toTemplate(row: Template): TemplateDto {
    return {
      id: row.id,
      name: row.name,
      icon: row.icon,
      paperBackground: row.paperBackground,
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
    }
  }
}
