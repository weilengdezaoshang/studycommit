// @vitest-environment node
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { loadDesktopEnvFile } from './load-desktop-env'

describe('loadDesktopEnvFile', () => {
  const originalCwd = process.cwd()

  afterEach(() => {
    process.chdir(originalCwd)
  })

  it('fills missing STUDYCOMMIT values from .env without overriding existing env', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'studycommit-env-'))
    await writeFile(
      join(dir, '.env'),
      [
        'STUDYCOMMIT_API_ORIGIN=http://localhost:3000',
        'STUDYCOMMIT_DEV_USER_ID=11111111-1111-4111-8111-111111111111',
      ].join('\n'),
    )
    process.chdir(dir)
    const loaded = loadDesktopEnvFile({
      STUDYCOMMIT_DEV_USER_ID: 'already-set',
    })
    expect(loaded.STUDYCOMMIT_API_ORIGIN).toBe('http://localhost:3000')
    expect(loaded.STUDYCOMMIT_DEV_USER_ID).toBe('already-set')
  })
})
