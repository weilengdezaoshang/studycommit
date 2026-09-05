import { Inject, Injectable } from '@nestjs/common'
import { and, eq, isNull, sql } from 'drizzle-orm'
import type { PaperExplainInput, PaperExplainOutput } from '@studycommit/rpc-contracts/ai'
import { DatabaseService } from '../database/database.service'
import { agentRuns, papers } from '../database/schema'
import { AGENT_RUN_KIND, AGENT_RUN_STATUS } from './ai.constants'

export type AgentRun = typeof agentRuns.$inferSelect

@Injectable()
export class AiRepository {
  // 显式注入:vitest 的 esbuild 转译不生成装饰器参数元数据
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async createExplainRun(
    userId: string,
    input: PaperExplainInput,
    promptVersion: string,
  ): Promise<AgentRun> {
    const [run] = await this.database.db
      .insert(agentRuns)
      .values({
        userId,
        kind: AGENT_RUN_KIND.paperExplain,
        status: AGENT_RUN_STATUS.pending,
        promptVersion,
        input,
      })
      .returning()
    return run
  }

  async completeExplainRun(runId: string, output: PaperExplainOutput) {
    await this.database.db
      .update(agentRuns)
      .set({
        status: AGENT_RUN_STATUS.completed,
        output,
        model: output.model,
        promptVersion: output.promptVersion,
        updatedAt: new Date(),
      })
      .where(eq(agentRuns.id, runId))
  }

  async failRun(runId: string, error: string, promptVersion: string) {
    await this.database.db
      .update(agentRuns)
      .set({
        status: AGENT_RUN_STATUS.failed,
        error,
        promptVersion,
        updatedAt: new Date(),
      })
      .where(eq(agentRuns.id, runId))
  }

  /** 用户确认后的结论落库时调用;确认状态是 AI 写入红线的证据。 */
  async confirmRun(runId: string, userId: string): Promise<boolean> {
    return this.database.db.transaction(async (tx) => {
      const [run] = await tx
        .select()
        .from(agentRuns)
        .where(and(eq(agentRuns.id, runId), eq(agentRuns.userId, userId)))
        .for('update')
        .limit(1)
      if (
        !run ||
        run.kind !== AGENT_RUN_KIND.paperExplain ||
        run.status !== AGENT_RUN_STATUS.completed
      ) {
        return false
      }
      if (run.confirmedAt) {
        return true
      }

      const input = run.input
      const paperId =
        typeof input === 'object' &&
        input !== null &&
        'paperId' in input &&
        typeof input.paperId === 'string'
          ? input.paperId
          : null
      if (paperId) {
        // 只有"还在思考"的纸页随确认落定为已解决,与 papers 的状态机一致;
        // 无问题或已解决的纸页只确认运行记录,避免绕过双写字段与乐观锁。
        await tx
          .update(papers)
          .set({
            questionStatus: 'resolved',
            questionResolvedAt: new Date(),
            hasQuestion: true,
            isQuestionResolved: true,
            version: sql`${papers.version} + 1`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(papers.id, paperId),
              eq(papers.userId, userId),
              eq(papers.questionStatus, 'thinking'),
              isNull(papers.deletedAt),
            ),
          )
      }

      await tx
        .update(agentRuns)
        .set({ confirmedAt: new Date(), updatedAt: new Date() })
        .where(eq(agentRuns.id, runId))
      return true
    })
  }
}
