import { Module } from '@nestjs/common';
import { EnvModule } from '@libs/environment';
import { RedisCommonProvider } from './providers';

@Module({
  imports: [EnvModule],
  providers: [RedisCommonProvider],
  exports: [RedisCommonProvider],
})
export class RedisModule {}
