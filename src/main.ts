import { NestFactory } from '@nestjs/core';
import { VersioningType } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ZodValidationPipe } from 'nestjs-zod';
import fastifyHelmet from '@fastify/helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  await app.register(fastifyHelmet);

  app.useGlobalPipes(new ZodValidationPipe());

  // added "/" and "/ondc" prefix to all routes
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: ['', 'ondc'],
    prefix: false,
  });

  await app.listen(4000, '0.0.0.0');
}
bootstrap();
