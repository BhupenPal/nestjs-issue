import { Provider } from '@nestjs/common';
import { EnvService } from '@libs/environment';
import Redis from 'ioredis';

export const REDIS_COMMON_CLIENT = Symbol('__REDIS_COMMON_CLIENT__');

export const RedisCommonProvider: Provider = {
  inject: [EnvService],
  useFactory: (envService: EnvService): Redis => {
    return new Redis(envService.get('REDIS_URL'));
  },
  provide: REDIS_COMMON_CLIENT,
};
