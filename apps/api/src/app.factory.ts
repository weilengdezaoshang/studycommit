import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger'
import { apiContract } from '@studycommit/rpc-contracts/contract'
import { OpenAPIGenerator } from '@orpc/openapi'
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4'
import { AppModule } from './app.module'
import { ErrorFilter } from './common/error.filter'
import { Logger, PinoLogger } from 'nestjs-pino'

const API_PREFIX = 'api'

function prefixContractPaths(
  paths: Record<string, unknown> | undefined,
  prefix: string,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(paths ?? {}).map(([path, definition]) => [`/${prefix}${path}`, definition]),
  )
}

function mergeComponents(
  nestDocument: OpenAPIObject,
  contractDocument: Awaited<ReturnType<OpenAPIGenerator['generate']>>,
) {
  return {
    ...nestDocument.components,
    ...contractDocument.components,
    schemas: {
      ...nestDocument.components?.schemas,
      ...contractDocument.components?.schemas,
    },
  }
}

export async function createApp(): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    bufferLogs: true,
  })
  app.useLogger(app.get(Logger))
  app.setGlobalPrefix(API_PREFIX)
  app.enableCors({ origin: process.env.NODE_ENV === 'production' ? false : true })
  app.useGlobalFilters(new ErrorFilter(await app.resolve(PinoLogger)))
  app.enableShutdownHooks()
  const nestDocument = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('StudyCommit API').setVersion('1.0').build(),
  )
  const contractDocument = await new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()],
  }).generate(apiContract, { info: nestDocument.info })
  const document = {
    ...nestDocument,
    openapi: contractDocument.openapi,
    paths: {
      ...nestDocument.paths,
      ...prefixContractPaths(contractDocument.paths, API_PREFIX),
    },
    components: mergeComponents(nestDocument, contractDocument),
  } as OpenAPIObject
  SwaggerModule.setup(`${API_PREFIX}/docs`, app, document)
  await app.init()
  await app.getHttpAdapter().getInstance().ready()
  return app
}
