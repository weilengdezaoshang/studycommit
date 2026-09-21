import { Inject, Injectable } from '@nestjs/common'
import { and, asc, count, eq, ne, sql } from 'drizzle-orm'
import { randomInt } from 'node:crypto'
import { DatabaseService } from '../database/database.service'
import {
  puzzleArtworks,
  puzzleOrganizeEvents,
  puzzleRewards,
  userPuzzleStates,
  userPuzzleCompletions,
} from '../database/schema'

type Tx = Parameters<Parameters<DatabaseService['db']['transaction']>[0]>[0]

function shanghaiDate(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(value)
}

@Injectable()
export class PuzzlesRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async album(userId: string) {
    const [artworks, state, rewards, completions] = await Promise.all([
      this.database.db
        .select()
        .from(puzzleArtworks)
        .where(ne(puzzleArtworks.status, 'draft'))
        .orderBy(asc(puzzleArtworks.sortOrder)),
      this.database.db.query.userPuzzleStates.findFirst({
        where: eq(userPuzzleStates.userId, userId),
      }),
      this.database.db
        .select()
        .from(puzzleRewards)
        .where(eq(puzzleRewards.userId, userId))
        .orderBy(asc(puzzleRewards.earnedAt)),
      this.database.db
        .select()
        .from(userPuzzleCompletions)
        .where(eq(userPuzzleCompletions.userId, userId)),
    ])
    return { artworks, state: state ?? null, rewards, completions }
  }

  async selectArtwork(userId: string, artworkId: string) {
    return this.database.db.transaction(async (tx) => {
      const [artwork] = await tx
        .select()
        .from(puzzleArtworks)
        .where(eq(puzzleArtworks.id, artworkId))
        .limit(1)
      if (!artwork || artwork.status !== 'published') {
        return false
      }
      await tx
        .insert(userPuzzleStates)
        .values({ userId, selectedArtworkId: artworkId })
        .onConflictDoUpdate({
          target: userPuzzleStates.userId,
          set: { selectedArtworkId: artworkId, updatedAt: sql`now()` },
        })
      return true
    })
  }

  async reveal(userId: string, rewardId: string) {
    return this.database.db.transaction(async (tx) => {
      const [reward] = await tx
        .update(puzzleRewards)
        .set({ revealedAt: sql`coalesce(${puzzleRewards.revealedAt}, now())` })
        .where(and(eq(puzzleRewards.id, rewardId), eq(puzzleRewards.userId, userId)))
        .returning()
      if (!reward) {
return null
}
      const [revealed] = await tx
        .select({ value: count() })
        .from(puzzleRewards)
        .where(
          and(
            eq(puzzleRewards.userId, userId),
            eq(puzzleRewards.artworkId, reward.artworkId),
            sql`${puzzleRewards.revealedAt} is not null`,
          ),
        )
      if (revealed.value === 12) {
        await tx
          .insert(userPuzzleCompletions)
          .values({ userId, artworkId: reward.artworkId })
          .onConflictDoNothing()
      }
      return reward
    })
  }

  async featureArtwork(userId: string, artworkId: string) {
    const completion = await this.database.db.query.userPuzzleCompletions.findFirst({
      where: and(
        eq(userPuzzleCompletions.userId, userId),
        eq(userPuzzleCompletions.artworkId, artworkId),
      ),
    })
    if (!completion) {
return false
}
    await this.database.db
      .update(userPuzzleStates)
      .set({ featuredArtworkId: artworkId, updatedAt: sql`now()` })
      .where(eq(userPuzzleStates.userId, userId))
    return true
  }

  /** 必须由纸页整理事务调用；首次从收件箱归档才可能计奖。 */
  async recordOrganization(tx: Tx, userId: string, paper: { id: string; createdAt: Date }) {
    if (shanghaiDate(paper.createdAt) >= shanghaiDate()) {
      return
    }
    const inserted = await tx
      .insert(puzzleOrganizeEvents)
      .values({ userId, paperId: paper.id })
      .onConflictDoNothing()
      .returning()
    if (!inserted.length) {
      return
    }
    const [state] = await tx
      .select()
      .from(userPuzzleStates)
      .where(eq(userPuzzleStates.userId, userId))
      .for('update')
      .limit(1)
    if (!state?.selectedArtworkId) {
      return
    }
    // 与管理员替换原画共用行锁，避免发放与换图同时发生。
    await tx
      .select({ id: puzzleArtworks.id })
      .from(puzzleArtworks)
      .where(eq(puzzleArtworks.id, state.selectedArtworkId))
      .for('update')
    const today = shanghaiDate()
    if (state.lastRewardDate === today) {
      return
    }
    const credit = state.credit + 1
    if (credit < 3) {
      await tx
        .update(userPuzzleStates)
        .set({ credit, updatedAt: sql`now()` })
        .where(eq(userPuzzleStates.userId, userId))
      return
    }
    const owned = await tx
      .select({ pieceIndex: puzzleRewards.pieceIndex })
      .from(puzzleRewards)
      .where(
        and(eq(puzzleRewards.userId, userId), eq(puzzleRewards.artworkId, state.selectedArtworkId)),
      )
    const ownedSet = new Set(owned.map((item) => item.pieceIndex))
    const available = Array.from({ length: 12 }, (_, index) => index).filter(
      (index) => !ownedSet.has(index),
    )
    if (!available.length) {
      return
    }
    const pieceIndex = available[randomInt(available.length)]
    await tx
      .insert(puzzleRewards)
      .values({ userId, artworkId: state.selectedArtworkId, pieceIndex, rewardDate: today })
    await tx
      .update(userPuzzleStates)
      .set({ credit: 0, lastRewardDate: today, updatedAt: sql`now()` })
      .where(eq(userPuzzleStates.userId, userId))
  }
}
