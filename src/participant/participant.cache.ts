import { Inject, Injectable } from '@nestjs/common';
import { ICacheClient, REDIS_COMMON_CLIENT, RedisClient } from '@libs/redis';

@Injectable()
export class ParticipantCache extends ICacheClient {
  constructor(@Inject(REDIS_COMMON_CLIENT) redisClient: RedisClient) {
    super(redisClient);
  }

  setOndcVerificationCode({ requestId }: { requestId: string }) {
    return this.setKey('ondc:requestId', requestId);
  }

  unsetOndcVerificationCode() {
    return this.deleteKey('ondc:requestId');
  }
}
