import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { ErrorFilter } from './common/error.filter'
export async function createApp(): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter({ logger: process.env.NODE_ENV !== 'test' }))
  app.setGlobalPrefix('api')
  app.enableCors({ origin: process.env.NODE_ENV === 'production' ? false : true })
  app.useGlobalFilters(new ErrorFilter())
  app.enableShutdownHooks()
  const document = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('StudyCommit API').setVersion('1.0').build())
  SwaggerModule.setup('api/docs', app, document)
  await app.init()
  await app.getHttpAdapter().getInstance().ready()
  return app
}
