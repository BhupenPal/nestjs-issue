import { RedisClient } from '../types';

export class ICacheClient {
  constructor(protected readonly redisClient: RedisClient) {}

  protected async getKey<T = object>(key: string): Promise<T | null> {
    const cacheValue = await this.redisClient.get(key);
    if (!cacheValue) return null;

    return JSON.parse(cacheValue);
  }

  protected setKey(
    key: string,
    value: string | number | Buffer | object,
    expiresAt?: Date,
  ) {
    if (typeof value === 'object') {
      value = JSON.stringify(value);
    }

    if (!expiresAt) {
      return this.redisClient.set(key, value);
    }

    let secondsTillExpireAt = 0;

    secondsTillExpireAt = Math.floor(
      (expiresAt.getTime() - new Date().getTime()) / 1000,
    );

    return this.redisClient.set(key, value, 'EX', secondsTillExpireAt);
  }

  protected deleteKey(key: string) {
    return this.redisClient.del(key);
  }
}
