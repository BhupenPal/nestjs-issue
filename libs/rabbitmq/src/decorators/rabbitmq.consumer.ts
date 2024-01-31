import { Controller, SetMetadata, applyDecorators } from '@nestjs/common';
import { RABBIT_CONSUMER } from '../constants';

export const RabbitConsumer = () =>
  applyDecorators(
    Controller(),
    SetMetadata(RABBIT_CONSUMER.identifier, RABBIT_CONSUMER.value),
  );
