import { SetMetadata, applyDecorators } from '@nestjs/common';
import { RABBIT_HANDLER, RABBIT_MSG_ROUTER } from '../constants';

type queueName = string;

export type IRabbitHandlerOptions = queueName;

export const RabbitHandler = (queue: IRabbitHandlerOptions) =>
  applyDecorators(
    SetMetadata(RABBIT_MSG_ROUTER, queue),
    SetMetadata(RABBIT_HANDLER.identifier, RABBIT_HANDLER.value),
  );
