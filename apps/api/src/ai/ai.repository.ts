import { Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import type { PaperExplainInput, PaperExplainOutput } from '@studycommit/rpc-contracts/ai'
import { DatabaseService } from '../database/database.service'
import { agentRuns } from '../database/schema'
import { AGENT_RUN_KIND, AGENT_RUN_STATUS } from './ai.constants'

export type AgentRun = typeof agentRuns.$inferSelect

@Injectable()
export class AiRepository {
  constructor(private readonly database: DatabaseService) {}

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
  async confirmRun(runId: string, userId: string) {
    await this.database.db
      .update(agentRuns)
      .set({ confirmedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(agentRuns.id, runId), eq(agentRuns.userId, userId)))
  }
}
