import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { Pool } from 'pg'
import { readdir, readFile } from 'node:fs/promises'
import { resolve, basename } from 'node:path'

async function main() {
  const required = [
    'DATABASE_URL',
    'S3_ENDPOINT',
    'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY',
  ] as const
  for (const key of required) {
if (!process.env[key]) {
throw new Error(`缺少 ${key}`)
}
}
  const client = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? 'us-east-1',
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  })
  const bucket = process.env.S3_BUCKET ?? 'studycommit-assets'
  const directory = resolve(process.cwd(), 'assets/puzzles')
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    for (const file of await readdir(directory)) {
      if (!file.endsWith('.png')) {
continue
}
      const key = basename(file, '.png'),
        storageKey = `puzzle-artworks/${key}/original.png`
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: storageKey,
          Body: await readFile(resolve(directory, file)),
          ContentType: 'image/png',
        }),
      )
      await pool.query('update puzzle_artwork_assets set storage_key=$1 where key=$2', [
        storageKey,
        key,
      ])
      console.log(`已迁移 ${key}`)
    }
  } finally {
    await pool.end()
  }
}
void main()
