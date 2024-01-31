import { Module } from '@nestjs/common';
import { RabbitMqModule } from '@libs/rabbitmq';
import { CoreModule } from '@integrations/core';
import { OndcModule } from '@integrations/ondc';
import { BuyerConsumer } from './buyer.consumer';
import { BuyerHook } from './buyer.hook';
import { ParticipantModule } from '@root/participant';

@Module({
  imports: [CoreModule, OndcModule, RabbitMqModule, ParticipantModule],
  controllers: [BuyerHook, BuyerConsumer],
})
export class BuyerModule {}
