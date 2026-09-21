import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type { PoolClient } from 'pg'
import type { PaperKnowledge, PaperKnowledgeCommand } from '@studycommit/rpc-contracts/papers'
import {
  PAPER_KNOWLEDGE_ADDITION_LIMIT,
  PAPER_KNOWLEDGE_RELATION_LIMIT,
} from '@studycommit/rpc-contracts/papers'
import { DatabaseService } from '../database/database.service'

/** UUID 按规范小写后再比大小,与 Postgres uuid CHECK 一致。 */
export function canonicalPaperPair(left: string, right: string): [string, string] {
  const [first, second] = [left.toLowerCase(), right.toLowerCase()]
  return first < second ? [first, second] : [second, first]
}

@Injectable()
export class PaperKnowledgeService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}
  private async requirePaper(client: PoolClient, userId: string, id: string) {
    const result = await client.query(
      'SELECT id FROM papers WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL FOR UPDATE',
      [id, userId],
    )
    if (!result.rowCount) {
      throw new NotFoundException('记录不存在或已删除')
    }
  }
  private async read(client: PoolClient, userId: string, id: string): Promise<PaperKnowledge> {
    const additions = await client.query(
      'SELECT id,kind,content,created_at AS "createdAt" FROM paper_additions WHERE user_id=$1 AND paper_id=$2 ORDER BY created_at DESC,id DESC LIMIT $3',
      [userId, id, PAPER_KNOWLEDGE_ADDITION_LIMIT + 1],
    )
    const relations = await client.query(
      `SELECT r.id,p.id AS "targetId",p.content,r.reason,r.version,r.created_at AS "createdAt" FROM paper_relations r JOIN papers p ON p.id=CASE WHEN r.paper_a=$2 THEN r.paper_b ELSE r.paper_a END WHERE r.user_id=$1 AND (r.paper_a=$2 OR r.paper_b=$2) AND r.deleted_at IS NULL AND p.user_id=$1 AND p.deleted_at IS NULL ORDER BY r.created_at DESC,r.id DESC LIMIT $3`,
      [userId, id, PAPER_KNOWLEDGE_RELATION_LIMIT + 1],
    )
    const additionRows = additions.rows.slice(0, PAPER_KNOWLEDGE_ADDITION_LIMIT).reverse()
    const relationRows = relations.rows.slice(0, PAPER_KNOWLEDGE_RELATION_LIMIT).reverse()
    return {
      additions: additionRows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
      relations: relationRows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
      additionsHasMore: additions.rows.length > PAPER_KNOWLEDGE_ADDITION_LIMIT,
      relationsHasMore: relations.rows.length > PAPER_KNOWLEDGE_RELATION_LIMIT,
    }
  }
  async get(userId: string, id: string) {
    const client = await this.database.pool.connect()
    try {
      await this.requirePaper(client, userId, id)
      return await this.read(client, userId, id)
    } finally {
      client.release()
    }
  }
  private async liveRelationCount(client: PoolClient, userId: string, paperId: string) {
    const live = await client.query(
      'SELECT COUNT(*)::int AS n FROM paper_relations WHERE user_id=$1 AND (paper_a=$2 OR paper_b=$2) AND deleted_at IS NULL',
      [userId, paperId],
    )
    return live.rows[0].n as number
  }

  /** 新建或恢复关系前，两端都按上限计数；调用方须已按 paper_a、paper_b 顺序锁行。 */
  private async assertRelationCapacity(
    client: PoolClient,
    userId: string,
    paperIds: readonly string[],
  ) {
    for (const paperId of new Set(paperIds)) {
      if (
        (await this.liveRelationCount(client, userId, paperId)) >= PAPER_KNOWLEDGE_RELATION_LIMIT
      ) {
        throw new ConflictException('关联已达上限，请先移除不再需要的关系')
      }
    }
  }

  async update(userId: string, input: PaperKnowledgeCommand) {
    const client = await this.database.pool.connect()
    try {
      await client.query('BEGIN')
      if (input.kind === 'link') {
        for (const id of canonicalPaperPair(input.id, input.targetId)) {
          await this.requirePaper(client, userId, id)
        }
      } else if (input.kind !== 'restoreLink') {
        await this.requirePaper(client, userId, input.id)
      }
      if (input.kind === 'append') {
        const existing = await client.query(
          'SELECT id,kind,content FROM paper_additions WHERE id=$1 AND user_id=$2 AND paper_id=$3',
          [input.additionId, userId, input.id],
        )
        if (existing.rowCount) {
          const row = existing.rows[0]
          if (row.kind !== input.type || row.content !== input.content) {
            throw new ConflictException('追加标识已用于其他内容，请重新保存')
          }
        } else {
          const count = await client.query(
            'SELECT COUNT(*)::int AS n FROM paper_additions WHERE user_id=$1 AND paper_id=$2',
            [userId, input.id],
          )
          if (count.rows[0].n >= PAPER_KNOWLEDGE_ADDITION_LIMIT) {
            throw new ConflictException('补充已达上限，请新开记录继续')
          }
          await client.query(
            'INSERT INTO paper_additions(id,user_id,paper_id,kind,content) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING',
            [input.additionId, userId, input.id, input.type, input.content],
          )
          const inserted = await client.query(
            'SELECT id FROM paper_additions WHERE id=$1 AND user_id=$2 AND paper_id=$3 AND kind=$4 AND content=$5',
            [input.additionId, userId, input.id, input.type, input.content],
          )
          if (!inserted.rowCount) {
            throw new ConflictException('追加标识已用于其他内容，请重新保存')
          }
        }
      } else if (input.kind === 'link') {
        if (input.id.toLowerCase() === input.targetId.toLowerCase()) {
          throw new BadRequestException('不能关联记录自身')
        }
        const [a, b] = canonicalPaperPair(input.id, input.targetId)
        const existing = await client.query(
          'SELECT id,reason,deleted_at FROM paper_relations WHERE user_id=$1 AND paper_a=$2 AND paper_b=$3',
          [userId, a, b],
        )
        let row = existing.rows[0]
        if (!row || row.deleted_at) {
          await this.assertRelationCapacity(client, userId, [a, b])
        }
        if (!row) {
          await client.query(
            'INSERT INTO paper_relations(id,user_id,paper_a,paper_b,reason) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,paper_a,paper_b) DO NOTHING',
            [input.relationId, userId, a, b, input.reason],
          )
          const inserted = await client.query(
            'SELECT id,reason,deleted_at FROM paper_relations WHERE user_id=$1 AND paper_a=$2 AND paper_b=$3',
            [userId, a, b],
          )
          row = inserted.rows[0]
        }
        if (!row) {
          throw new ConflictException('这两条记录已有关系，请查看现有关联或撤销删除')
        }
        if (row.deleted_at) {
          await client.query(
            'UPDATE paper_relations SET deleted_at=NULL, reason=$1, version=version+1 WHERE id=$2 AND user_id=$3',
            [input.reason, row.id, userId],
          )
        } else if (row.id !== input.relationId || row.reason !== input.reason) {
          throw new ConflictException('这两条记录已有关系，请查看现有关联或撤销删除')
        }
      } else {
        const existing = await client.query(
          'SELECT id,paper_a,paper_b,deleted_at FROM paper_relations WHERE id=$1 AND user_id=$2 AND (paper_a=$3 OR paper_b=$3) AND version=$4',
          [input.relationId, userId, input.id, input.version],
        )
        const row = existing.rows[0]
        if (!row) {
          throw new ConflictException('关系已变化，请刷新后重试')
        }
        if (input.kind === 'restoreLink') {
          await this.requirePaper(client, userId, row.paper_a)
          await this.requirePaper(client, userId, row.paper_b)
          if (row.deleted_at) {
            await this.assertRelationCapacity(client, userId, [row.paper_a, row.paper_b])
          }
        }
        const result = await client.query(
          `UPDATE paper_relations SET deleted_at=${input.kind === 'unlink' ? 'now()' : 'NULL'},version=version+1 WHERE id=$1 AND user_id=$2 AND version=$3 RETURNING id`,
          [input.relationId, userId, input.version],
        )
        if (!result.rowCount) {
          throw new ConflictException('关系已变化，请刷新后重试')
        }
      }
      const result = await this.read(client, userId, input.id)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
}
