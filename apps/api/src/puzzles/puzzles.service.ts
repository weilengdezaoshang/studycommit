import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { PuzzleAlbum, PuzzleReward } from '@studycommit/rpc-contracts/puzzles'
import { PuzzlesRepository } from './puzzles.repository'

@Injectable()
export class PuzzlesService {
  constructor(@Inject(PuzzlesRepository) private readonly repository: PuzzlesRepository) {}

  async album(userId: string): Promise<PuzzleAlbum> {
    const value = await this.repository.album(userId)
    return {
      selectedArtworkId: value.state?.selectedArtworkId ?? null,
      featuredArtworkId: value.state?.featuredArtworkId ?? null,
      credit: value.state?.credit ?? 0,
      artworks: value.artworks
        .filter((artwork) => artwork.status !== 'draft')
        .map((artwork) => {
          const rewards = value.rewards.filter((reward) => reward.artworkId === artwork.id)
          const completion = value.completions.find((item) => item.artworkId === artwork.id)
          return {
            id: artwork.id,
            slug: artwork.slug,
            title: artwork.title,
            description: artwork.description,
            assetKey: artwork.assetKey,
            version: artwork.version,
            pieceCount: 12,
            status: artwork.status as 'published' | 'retired',
            collectedCount: rewards.filter((reward) => reward.revealedAt).length,
            completedAt: completion?.completedAt.toISOString() ?? null,
            featured: value.state?.featuredArtworkId === artwork.id,
          }
        }),
      rewards: value.rewards.map(this.mapReward),
    }
  }

  async featureArtwork(userId: string, artworkId: string) {
    if (!(await this.repository.featureArtwork(userId, artworkId))) {
      throw new NotFoundException('只能展示已完成的画作')
    }
    return this.album(userId)
  }

  async selectArtwork(userId: string, artworkId: string) {
    if (!(await this.repository.selectArtwork(userId, artworkId))) {
      throw new NotFoundException('画作不存在或已下架')
    }
    return this.album(userId)
  }

  async reveal(userId: string, rewardId: string): Promise<PuzzleReward> {
    const reward = await this.repository.reveal(userId, rewardId)
    if (!reward) {
      throw new NotFoundException('拼图奖励不存在')
    }
    return this.mapReward(reward)
  }

  private mapReward(reward: {
    id: string
    artworkId: string
    pieceIndex: number
    earnedAt: Date
    revealedAt: Date | null
  }): PuzzleReward {
    return {
      ...reward,
      earnedAt: reward.earnedAt.toISOString(),
      revealedAt: reward.revealedAt?.toISOString() ?? null,
    }
  }
}
