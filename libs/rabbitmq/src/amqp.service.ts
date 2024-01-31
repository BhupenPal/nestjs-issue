import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleDestroy,
} from '@nestjs/common';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { EnvService } from '@libs/environment';
import {
  Connection as AmqpConnection,
  Channel as AmqpChannel,
  connect as amqpConnect,
  Options as AmqpOptions,
} from 'amqplib';
import {
  RABBIT_CONSUMER,
  RABBIT_HANDLER,
  RABBIT_MSG_ROUTER,
} from './constants';
import { IRabbitHandlerOptions } from './decorators/rabbitmq.handler';

type IPublishMessage = {
  exchange: string;
  routingKey: string;
  message: Buffer;
  options: AmqpOptions.Publish;
};

type IRabbitExchange = {
  name: string;
  type: 'direct' | 'fanout' | 'topic' | 'headers';
  options: AmqpOptions.AssertExchange;
};

type IRabbitConsumer = Pick<InstanceWrapper, 'metatype' | 'name' | 'instance'>;

type IRabbitHandler = {
  consumerInstance: { [key: string]: (data: any) => Promise<void> };
  handlerIdentifier: string;
  methodName: string;
  routingKey: string;
};

type IRabbitRouter = {
  [queue: string]: IRabbitHandler;
};

@Injectable()
export class AmqpService implements OnModuleDestroy, OnApplicationShutdown {
  private readonly logger = new Logger(AmqpService.name);

  private amqpConnectionString: string;
  private amqpConnection: AmqpConnection | undefined;
  private amqpChannel: AmqpChannel | undefined;
  private rabbitRouter: IRabbitRouter | undefined;

  private readonly pendingRabbitRequests: IPublishMessage[] = [];

  private readonly DEAD_LETTER_EXCHANGE: IRabbitExchange = {
    name: 'DeadLetterExchange',
    type: 'direct',
    options: {
      autoDelete: false,
      durable: true,
      internal: true,
    },
  } as const;

  private isAmqpChannelReady: boolean = false;
  private deadLetterExchangeSetupDone = false;
  private rabbitRouterSetupDone = false;
  private queueSetupDone = false;
  private consumerSetupDone = false;
  private firstAttemptForConnectionAlreadyDone = false;

  constructor(
    private readonly envService: EnvService,
    private readonly discoveryService: DiscoveryService,
  ) {
    this.amqpConnectionString = this.envService.get('RABBITMQ_URL');

    this.connectToRabbitMq();
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnectFromRabbitMq();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.disconnectFromRabbitMq();
  }

  async connectToRabbitMq() {
    if (this.firstAttemptForConnectionAlreadyDone) {
      let delay = 3000;

      const connectionInterval = setInterval(() => {
        this.logger.fatal(
          `Retrying connecting to RabbitMq in ${Math.ceil(delay / 1000)}(s)...`,
        );
        delay -= 1000;
      }, 1000);

      await new Promise((resolve) =>
        setTimeout(() => {
          clearInterval(connectionInterval);
          resolve(true);
        }, 3500),
      );
    }

    if (!this.amqpConnection) {
      await this.initializeConnection();
    }

    if (this.amqpConnection && !this.amqpChannel) {
      await this.initializeChannel();
    }

    if (this.amqpChannel && !this.deadLetterExchangeSetupDone) {
      await this.setupDeadLetterExchange();
    }

    if (this.deadLetterExchangeSetupDone && !this.rabbitRouter) {
      this.createRabbitRouter();
    }

    if (this.rabbitRouterSetupDone && !this.queueSetupDone) {
      await this.setupQueues();
    }

    if (this.queueSetupDone && !this.consumerSetupDone) {
      this.setupConsumers();
    }

    if (this.consumerSetupDone) {
      this.reDrivePendingRabbitRequests();
    }
  }

  async disconnectFromRabbitMq() {
    await this.amqpChannel?.close();
    this.amqpChannel = undefined;

    await this.amqpConnection?.close();
    this.amqpConnection = undefined;
  }

  private async initializeConnection() {
    this.firstAttemptForConnectionAlreadyDone = true;

    try {
      this.amqpConnection = await amqpConnect(this.amqpConnectionString, {
        timeout: 10000,
        keepAlive: true,
      });

      this.logger.log('RabbitMQ connection established');

      this.amqpConnection.on('error', (error) => {
        this.isAmqpChannelReady = false;
        this.logger.error(error);
        this.connectToRabbitMq();
      });
    } catch (error) {
      this.logger.error(error);
      await this.disconnectFromRabbitMq();
      this.connectToRabbitMq();
    }
  }

  private async initializeChannel() {
    if (!this.amqpConnection) {
      this.logger.error(
        'No amqp connection available. Unable to create a channel. Retrying connection.',
      );

      this.connectToRabbitMq();
      return;
    }

    try {
      this.amqpChannel = await this.amqpConnection.createChannel();
      this.isAmqpChannelReady = true;

      this.logger.log('RabbitMQ channel created. Ready to publish messages');

      this.amqpChannel.on('error', (error) => {
        this.logger.error(error);
        this.isAmqpChannelReady = false;
        this.connectToRabbitMq();
      });
    } catch (error) {
      this.logger.error(error);
      this.connectToRabbitMq();
    }
  }

  private async setupDeadLetterExchange() {
    if (!this.amqpChannel) {
      this.logger.warn(
        'No amqp channel available. Unable to setup dead letter exchange.',
      );

      this.connectToRabbitMq();

      return;
    }

    await this.amqpChannel.assertExchange(
      this.DEAD_LETTER_EXCHANGE.name,
      this.DEAD_LETTER_EXCHANGE.type,
      this.DEAD_LETTER_EXCHANGE.options,
    );

    this.deadLetterExchangeSetupDone = true;
  }

  private createRabbitRouter(): void {
    const rabbitConsumers = this.discoveryService
      .getControllers()
      .filter(
        ({ metatype }) =>
          metatype && Reflect.getMetadata(RABBIT_CONSUMER.identifier, metatype),
      ) as IRabbitConsumer[];

    const metadataScanner = new MetadataScanner();
    const router: IRabbitRouter = {};

    for (const consumer of rabbitConsumers) {
      const consumerInstance = consumer.instance;
      const consumerPrototype = Object.getPrototypeOf(consumerInstance);

      const methodsOfConsumer =
        metadataScanner.getAllMethodNames(consumerPrototype);

      const methodsWithRabbitHandler = methodsOfConsumer.filter(
        (methodName) =>
          Reflect.getMetadata(
            RABBIT_HANDLER.identifier,
            consumerInstance[methodName],
          ) === RABBIT_HANDLER.value,
      );

      methodsWithRabbitHandler.forEach((methodName) => {
        const queueName = Reflect.getMetadata(
          RABBIT_MSG_ROUTER,
          consumerInstance[methodName],
        ) as IRabbitHandlerOptions;

        const routeDetails: IRabbitHandler = {
          consumerInstance: consumerInstance,
          handlerIdentifier: `${consumer.name}:${methodName}`,
          methodName,
          routingKey: queueName,
        };

        if (router[queueName]) {
          throw new Error(
            `2 or more handlers present for same queue. Queue Name: ${queueName}`,
            {
              cause: 'Duplicate queue',
            },
          );
        }

        router[queueName] = routeDetails;
      });
    }

    this.rabbitRouter = router;
    this.rabbitRouterSetupDone = true;
  }

  private async setupQueues(): Promise<void> {
    if (!this.rabbitRouter) {
      this.logger.error(
        'No rabbit router available. Unable to setup queues. Retrying connection.',
      );

      this.connectToRabbitMq();

      return;
    }

    const queuePromises = Object.keys(this.rabbitRouter).map((queue) => {
      if (!this.amqpChannel) {
        this.logger.error(
          'No amqp channel available. Unable to setup queues. Retrying connection.',
        );

        this.connectToRabbitMq();

        return;
      }

      if (!this.rabbitRouter) {
        this.logger.error(
          'No rabbit router available. Unable to setup queues. Retrying connection.',
        );

        this.connectToRabbitMq();

        return;
      }

      if (!this.rabbitRouter[queue]) {
        this.logger.error('No handler found for queue. Queue Name: ', queue);
        return;
      }

      const deadLetterQueueName = `${queue}.dlq`;

      const mainQueue = this.amqpChannel.assertQueue(queue, {
        autoDelete: false,
        durable: true,
        arguments: {
          'x-queue-type': 'quorum',
          'x-dead-letter-exchange': this.DEAD_LETTER_EXCHANGE.name,
          'x-dead-letter-routing-key': deadLetterQueueName,
        },
      });

      const deadLetterQueue = this.amqpChannel.assertQueue(
        deadLetterQueueName,
        {
          autoDelete: false,
          durable: true,
          arguments: {
            'x-queue-type': 'quorum',
          },
        },
      );

      const dlqAndDlxBinding = this.amqpChannel.bindQueue(
        deadLetterQueueName,
        this.DEAD_LETTER_EXCHANGE.name,
        deadLetterQueueName,
      );

      return [mainQueue, deadLetterQueue, dlqAndDlxBinding];
    });

    await Promise.all(queuePromises.flat());
    this.queueSetupDone = true;
  }

  private setupConsumers() {
    if (!this.rabbitRouter) {
      this.logger.error(
        'No rabbit router available. Unable to setup consumers.',
      );

      this.connectToRabbitMq();

      return;
    }

    Object.keys(this.rabbitRouter).forEach((queue) => {
      if (this.amqpChannel === undefined) {
        this.logger.error(
          'No amqp channel available. Unable to setup consumers.',
        );
        return;
      }

      this.amqpChannel.consume(queue, async (msg) => {
        if (msg === null || this.amqpChannel === undefined) {
          return;
        }

        const { content, properties } = msg;
        const maxRetriesAllowed =
          parseInt(properties.headers?.['x-max-retries']) ?? 3;
        const currentAttemptCount =
          parseInt(properties.headers?.['x-delivery-count'] ?? 0) + 1;

        try {
          if (!this.rabbitRouter) {
            this.logger.error(
              'No rabbit router available. Unable to setup consumers.',
            );

            return;
          }

          const queueHandler = this.rabbitRouter[queue];

          if (!queueHandler) {
            this.logger.error(
              'No handler found for queue. Queue Name: ',
              queue,
            );
            return;
          }

          const queueHandlerMethod =
            queueHandler.consumerInstance[queueHandler.methodName];

          if (typeof queueHandlerMethod !== 'function') {
            throw new Error('Handler is not a function');
          }

          await queueHandlerMethod.call(
            queueHandler.consumerInstance,
            JSON.parse(content.toString()),
          );

          this.amqpChannel.ack(msg);
          return;
        } catch (error) {
          this.logger.error(error);

          if (currentAttemptCount >= maxRetriesAllowed) {
            this.amqpChannel.reject(msg, false);
            return;
          }

          this.amqpChannel.nack(msg, false, true);
          return;
        }
      });
    });

    this.consumerSetupDone = true;
  }

  publish(data: IPublishMessage) {
    try {
      if (
        this.amqpConnection === undefined ||
        this.amqpChannel === undefined ||
        !this.isAmqpChannelReady
      ) {
        this.pendingRabbitRequests.push(data);

        return true;
      }

      this.amqpChannel.publish(data.exchange, data.routingKey, data.message, {
        ...(data && data.options),
      });

      return true;
    } catch (error) {
      this.logger.error(error);
      return false;
    }
  }

  reDrivePendingRabbitRequests() {
    if (
      this.amqpConnection === undefined ||
      this.amqpChannel === undefined ||
      !this.isAmqpChannelReady
    ) {
      return;
    }

    while (this.pendingRabbitRequests.length > 0) {
      const data = this.pendingRabbitRequests.shift();

      if (data) {
        this.publish(data);
      }
    }
  }
}
