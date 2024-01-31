import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { EnvModule } from '@libs/environment';
import { AmqpService } from './amqp.service';
import { RabbitMqService } from './rabbitmq.service';

@Module({
  imports: [DiscoveryModule, EnvModule],
  providers: [AmqpService, RabbitMqService],
  exports: [RabbitMqService],
})
export class RabbitMqModule {}
