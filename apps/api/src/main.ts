import 'reflect-metadata'
import { createApp } from './app.factory'
import { ConfigService } from '@nestjs/config'

async function bootstrap(): Promise<void> {
  const app = await createApp()
  const port = app.get(ConfigService).getOrThrow<number>('API_PORT')
  await app.listen(port, '0.0.0.0')
}

void bootstrap()
