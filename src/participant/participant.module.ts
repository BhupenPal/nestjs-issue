import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EnvModule } from '@libs/environment';
import { RedisModule } from '@libs/redis';
import { OndcModule } from '@integrations/ondc';
import { NetworkParticipantSchema } from './model';
import { ParticipantController } from './participant.controller';
import { ParticipantService } from './participant.service';
import { ParticipantCache } from './participant.cache';
import { ParticipantHook } from './participant.hook';

const MongooseModels = MongooseModule.forFeature([
  {
    name: 'Network Participants',
    collection: 'Network Participants',
    schema: NetworkParticipantSchema,
  },
]);

@Module({
  imports: [OndcModule, RedisModule, EnvModule, MongooseModels],
  controllers: [ParticipantController, ParticipantHook],
  providers: [ParticipantService, ParticipantCache],
  exports: [ParticipantService],
})
export class ParticipantModule {}
