import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { BuyerHookGuard } from '@integrations/ondc';
import { RabbitMqService } from '@libs/rabbitmq';
import { OnSearchPayload } from './dto/consumer/on-search.dto';

@Controller('buyers/hook')
@UseGuards(BuyerHookGuard)
export class BuyerHook {
  constructor(private readonly rabbitMqService: RabbitMqService) {}

  @Post('on_search')
  @HttpCode(200)
  async searchOndcGateway(@Body() body: any) {
    this.rabbitMqService.publish<OnSearchPayload>('on_search', {
      requestPayload: body,
      subscriberId: body.subscriberId,
    });

    return {
      success: true,
    };
  }

  @Post('on_select')
  @HttpCode(200)
  async selectOndcGateway(@Body() body: any) {
    this.rabbitMqService.publish<OnSearchPayload>('on_select', {
      requestPayload: body,
      subscriberId: body.subscriberId,
    });

    return {
      success: true,
    };
  }

  @Post('on_init')
  @HttpCode(200)
  async initOndc(@Body() body: any) {
    this.rabbitMqService.publish<OnSearchPayload>('on_init', {
      requestPayload: body,
      subscriberId: body.subscriberId,
    });

    return {
      success: true,
    };
  }

  @Post('on_confirm')
  @HttpCode(200)
  async confirmOndc(@Body() body: any) {
    this.rabbitMqService.publish<OnSearchPayload>('on_confirm', {
      requestPayload: body,
      subscriberId: body.subscriberId,
    });

    return {
      success: true,
    };
  }

  @Post('on_track')
  @HttpCode(200)
  async trackOndc(@Body() body: any) {
    this.rabbitMqService.publish<OnSearchPayload>('on_track', {
      requestPayload: body,
      subscriberId: body.subscriberId,
    });

    return {
      success: true,
    };
  }

  @Post('on_cancel')
  @HttpCode(200)
  async cancelOndc(@Body() body: any) {
    this.rabbitMqService.publish<OnSearchPayload>('on_cancel', {
      requestPayload: body,
      subscriberId: body.subscriberId,
    });

    return {
      success: true,
    };
  }

  @Post('on_update')
  @HttpCode(200)
  async updateOndc(@Body() body: any) {
    this.rabbitMqService.publish<OnSearchPayload>('on_update', {
      requestPayload: body,
      subscriberId: body.subscriberId,
    });

    return {
      success: true,
    };
  }

  @Post('on_rating')
  @HttpCode(200)
  async ratingOndc(@Body() body: any) {
    this.rabbitMqService.publish<OnSearchPayload>('on_rating', {
      requestPayload: body,
      subscriberId: body.subscriberId,
    });

    return {
      success: true,
    };
  }

  @Post('on_support')
  @HttpCode(200)
  async supportOndcGateway(@Body() body: any) {
    this.rabbitMqService.publish<OnSearchPayload>('on_support', {
      requestPayload: body,
      subscriberId: body.subscriberId,
    });

    return {
      success: true,
    };
  }
}
