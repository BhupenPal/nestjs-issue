import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateConfig } from './env.schema';
import { EnvService } from './env.service';

@Module({
  imports: [
    /**
     * ConfigModule.forRoot() method will load the .env file and validate it against the schema.
     * Tho, it is not being injected in env.service.ts using dependency injection, it still needs
     * to be imported in env.module.ts to make sure that the .env file is validated.
     */
    ConfigModule.forRoot({
      envFilePath: '.env',
      cache: true,
      validate: validateConfig,
    }),
  ],
  providers: [EnvService],
  exports: [EnvService],
})
export class EnvModule {}
