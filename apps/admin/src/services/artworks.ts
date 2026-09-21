import { client } from './admin-api'
export type ArtworkDraft = {
  title: string
  description: string
  style: string
  assetKey: string
  sortOrder: number
}
export type Artwork = ArtworkDraft & {
  id: string
  slug: string
  version: number
  pieceCount: 12
  status: 'draft' | 'published' | 'retired'
  updatedAt: string
  hasRewards: boolean
}
export type ArtworkAsset = {
  key: string
  title: string
  style: string
  width: number
  height: number
}
export const artworkImage = (key: string) => `/api/puzzles/assets/${encodeURIComponent(key)}`
export const artworkApi = {
  list: () => client.get<{ items: Artwork[] }>('/api/admin/artworks'),
  assets: () => client.get<{ items: ArtworkAsset[] }>('/api/admin/artworks/assets'),
  uploadAsset: async (file: File, title: string, style: string) => {
    const key = `${
      title
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'artwork'
    }-${Date.now().toString(36)}`
    const cropped = await cropArtwork(file)
    const prepared = await client.post<{
      storageKey: string
      uploadUrl: string
      headers: Record<string, string>
    }>('/api/admin/artworks/assets/uploads', {
      key,
      title,
      style,
      mimeType: cropped.type,
      size: cropped.size,
    })
    const response = await fetch(prepared.uploadUrl, {
      method: 'PUT',
      headers: prepared.headers,
      body: cropped,
    })
    if (!response.ok) {
throw new Error('原画上传失败')
}
    return client.post<ArtworkAsset>('/api/admin/artworks/assets/uploads/complete', {
      key,
      title,
      style,
      storageKey: prepared.storageKey,
      mimeType: cropped.type,
    })
  },
  deleteAsset: (key: string) =>
    client.delete<{ deleted: boolean }>(`/api/admin/artworks/assets/${encodeURIComponent(key)}`, {
      key,
    }),
  save: (draft: ArtworkDraft, current?: Artwork) =>
    current
      ? client.put<Artwork>(`/api/admin/artworks/${current.id}`, {
          ...draft,
          id: current.id,
          expectedVersion: current.version,
          reason: '编辑画作信息',
        })
      : client.post<Artwork>('/api/admin/artworks', { ...draft, reason: '新建画作草稿' }),
  transition: (current: Artwork, status: 'published' | 'retired', reason: string) =>
    client.post<Artwork>(`/api/admin/artworks/${current.id}/status`, {
      id: current.id,
      expectedVersion: current.version,
      status,
      reason,
    }),
}

async function cropArtwork(file: File): Promise<Blob> {
  const image = await createImageBitmap(file)
  const ratio = 4 / 3
  const width = image.width / image.height > ratio ? image.height * ratio : image.width
  const height = width / ratio
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 900
  canvas
    .getContext('2d')
    ?.drawImage(
      image,
      (image.width - width) / 2,
      (image.height - height) / 2,
      width,
      height,
      0,
      0,
      1200,
      900,
    )
  image.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('图片裁切失败'))),
      'image/png',
    ),
  )
}
