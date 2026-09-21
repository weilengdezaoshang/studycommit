import { oc } from '@orpc/contract'
import { z } from 'zod'

export const puzzleArtworkSchema = z.object({
  id: z.uuid(),
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  assetKey: z.string().min(1),
  assetUrl: z.string().url().optional(),
  version: z.number().int().positive(),
  pieceCount: z.literal(12),
  status: z.enum(['published', 'retired']),
  collectedCount: z.number().int().min(0).max(12),
  completedAt: z.iso.datetime({ offset: true }).nullable(),
  featured: z.boolean(),
})

export const puzzleRewardSchema = z.object({
  id: z.uuid(),
  artworkId: z.uuid(),
  pieceIndex: z.number().int().min(0).max(11),
  earnedAt: z.iso.datetime({ offset: true }),
  revealedAt: z.iso.datetime({ offset: true }).nullable(),
})

export const puzzleAlbumSchema = z.object({
  selectedArtworkId: z.uuid().nullable(),
  featuredArtworkId: z.uuid().nullable(),
  credit: z.number().int().min(0).max(2),
  artworks: z.array(puzzleArtworkSchema),
  rewards: z.array(puzzleRewardSchema),
})

export const selectPuzzleArtworkInputSchema = z.object({ artworkId: z.uuid() })
export const revealPuzzleRewardInputSchema = z.object({ rewardId: z.uuid() })
export const featurePuzzleArtworkInputSchema = z.object({ artworkId: z.uuid() })

export const puzzlesContract = {
  album: oc
    .route({ method: 'GET', path: '/puzzles/album', summary: '读取拼图画册' })
    .output(puzzleAlbumSchema),
  selectArtwork: oc
    .route({ method: 'POST', path: '/puzzles/selection', summary: '选择当前收集画作' })
    .input(selectPuzzleArtworkInputSchema)
    .output(puzzleAlbumSchema),
  reveal: oc
    .route({
      method: 'POST',
      path: '/puzzles/rewards/{rewardId}/reveal',
      summary: '确认拼图碎片已揭晓',
    })
    .input(revealPuzzleRewardInputSchema)
    .output(puzzleRewardSchema),
  featureArtwork: oc
    .route({ method: 'POST', path: '/puzzles/featured', summary: '设置首页展示画作' })
    .input(featurePuzzleArtworkInputSchema)
    .output(puzzleAlbumSchema),
}

export type PuzzleAlbum = z.infer<typeof puzzleAlbumSchema>
export type PuzzleArtwork = z.infer<typeof puzzleArtworkSchema>
export type PuzzleReward = z.infer<typeof puzzleRewardSchema>

export const artworkDraftSchema = z.object({
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().max(240),
  style: z.string().trim().min(1).max(40),
  assetKey: z.string().regex(/^[a-z0-9-]{1,80}$/),
  sortOrder: z.number().int().min(0).max(9999),
})
export const adminArtworkSchema = artworkDraftSchema.extend({
  id: z.uuid(),
  slug: z.string(),
  version: z.number().int(),
  pieceCount: z.literal(12),
  status: z.enum(['draft', 'published', 'retired']),
  updatedAt: z.string(),
  hasRewards: z.boolean(),
})
const reason = z.string().trim().min(1).max(500)
export const adminPuzzlesContract = {
  list: oc
    .route({ method: 'GET', path: '/admin/artworks' })
    .output(z.object({ items: z.array(adminArtworkSchema) })),
  assets: oc.route({ method: 'GET', path: '/admin/artworks/assets' }).output(
    z.object({
      items: z.array(
        z.object({
          key: z.string(),
          title: z.string(),
          style: z.string(),
          width: z.number().int(),
          height: z.number().int(),
        }),
      ),
    }),
  ),
  prepareAsset: oc
    .route({ method: 'POST', path: '/admin/artworks/assets/uploads' })
    .input(
      z.object({
        key: z.string().regex(/^[a-z0-9-]{1,80}$/),
        title: z.string().trim().min(1).max(80),
        style: z.string().trim().min(1).max(40),
        mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
        size: z.number().int().positive().max(15_000_000),
      }),
    )
    .output(
      z.object({
        storageKey: z.string(),
        uploadUrl: z.string().url(),
        headers: z.record(z.string(), z.string()),
      }),
    ),
  completeAsset: oc
    .route({ method: 'POST', path: '/admin/artworks/assets/uploads/complete' })
    .input(
      z.object({
        key: z.string(),
        title: z.string(),
        style: z.string(),
        storageKey: z.string(),
        mimeType: z.string(),
      }),
    )
    .output(
      z.object({
        key: z.string(),
        title: z.string(),
        style: z.string(),
        width: z.number().int(),
        height: z.number().int(),
      }),
    ),
  deleteAsset: oc
    .route({ method: 'DELETE', path: '/admin/artworks/assets/{key}' })
    .input(z.object({ key: z.string() }))
    .output(z.object({ deleted: z.boolean() })),
  create: oc
    .route({ method: 'POST', path: '/admin/artworks' })
    .input(artworkDraftSchema.extend({ reason }))
    .output(adminArtworkSchema),
  update: oc
    .route({ method: 'PUT', path: '/admin/artworks/{id}' })
    .input(
      artworkDraftSchema.extend({
        id: z.uuid(),
        expectedVersion: z.number().int().positive(),
        reason,
      }),
    )
    .output(adminArtworkSchema),
  transition: oc
    .route({ method: 'POST', path: '/admin/artworks/{id}/status' })
    .input(
      z.object({
        id: z.uuid(),
        expectedVersion: z.number().int().positive(),
        status: z.enum(['published', 'retired']),
        reason,
      }),
    )
    .output(adminArtworkSchema),
}
export type AdminArtwork = z.infer<typeof adminArtworkSchema>
export type ArtworkDraft = z.infer<typeof artworkDraftSchema>
