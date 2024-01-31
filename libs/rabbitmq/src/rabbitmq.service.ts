import { Injectable } from '@nestjs/common';
import { AmqpService } from './amqp.service';
import { RmqMessageOptions } from './types';

@Injectable()
export class RabbitMqService {
  constructor(private readonly amqpService: AmqpService) {}

  publish<T>(queueName: string, message: T, options?: RmqMessageOptions) {
    return this.amqpService.publish({
      exchange: '', // default exchange
      routingKey: queueName, // routingKey = queueName (default behavior of RabbitMQ)
      message: Buffer.from(JSON.stringify(message)),
      options: {
        headers: {
          'x-max-retries': (options && options.maxRetries) || 3, // custom header
        },
        deliveryMode: 2, // 1 = non-persistent, 2 = persistent
      },
    });
  }
}
