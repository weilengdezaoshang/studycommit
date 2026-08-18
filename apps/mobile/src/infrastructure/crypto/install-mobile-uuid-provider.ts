import * as Crypto from 'expo-crypto'
import { setIdempotencyKeyProvider } from '@studycommit/common/study-session-runtime'

export function installMobileUuidProvider(): void {
  setIdempotencyKeyProvider(() => Crypto.randomUUID())
}
