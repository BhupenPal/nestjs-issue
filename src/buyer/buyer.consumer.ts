import { RabbitConsumer, RabbitHandler } from '@libs/rabbitmq';
import { OnSearchPayload } from './dto/consumer/on-search.dto';
import { CoreService } from '@integrations/core';
import { OndcService } from '@integrations/ondc';
import { ParticipantService } from '@root/participant';

@RabbitConsumer()
export class BuyerConsumer {
  constructor(
    private readonly ondcService: OndcService,
    private readonly coreService: CoreService,
    private readonly participantService: ParticipantService,
  ) {}

  @RabbitHandler('on_search')
  async searchOndcGateway({}: OnSearchPayload) {
    console.log(this.participantService, this.ondcService, this.coreService); // @@NESTJS_ISSUE@@

    const response = await this.coreService.getProducts({
      searchQuery: 'lays',
      host: 'http://host.docker.internal:3000/api/public/search',
      pageNo: 1,
    });

    if (!response.data.length) {
      return 'No data to be provided';
    }

    await this.ondcService.onSearch({
      subscriberId: 'namaste.business',
      subscriberUniqueKeyId: '65aa68decc37a03af525dfb6',
      subscriberPrivateKey:
        '+gwIa9iD4VcVlboJn7xQGukc1Ws95NQ49ekQfc7LcX2YYER/u882nYOh9pz28j4JPQLXj8TG170cT5FZO0wIiA==',
      catalog: {
        'bpp/descriptor': {
          images: [''],
          longDescription: 'Test Category',
          name: 'Category Name',
          shortDescription: 'Categoryyyy',
          symbol: 'CAT-1',
        },
        'bpp/provider': response.data.map((item) => {
          return {
            descriptor: {
              images: item.images.map((image) => image.url),
              longDescription: item.additionalInfo[0]?.info ?? '',
              name: 'Category Name',
              shortDescription: 'Categoryyyy',
              symbol: 'CAT-1',
            },
            exp: '',
            id: item._id,
            rateable: false,
            rating: 5,
            tags: [],
            ttl: '',
          };
        }),
      },
    });

    return '';
  }

  @RabbitHandler('on_select')
  async selectOndcGateway({}: OnSearchPayload) {
    console.log('CONSUMING');

    try {
      await this.ondcService.onSelect({
        // @ts-expect-error: To Be added
        context: {},
        subscriber: {
          id: 'namaste.business',
          uniqueKeyId: '65aa68decc37a03af525dfb6',
          privateKey:
            '+gwIa9iD4VcVlboJn7xQGukc1Ws95NQ49ekQfc7LcX2YYER/u882nYOh9pz28j4JPQLXj8TG170cT5FZO0wIiA==',
        },
      });
    } catch (error) {
      console.log(error);
    }

    console.log('CONSUMED');
  }

  @RabbitHandler('on_init')
  async initOndcGateway({}: OnSearchPayload) {
    await this.ondcService.onInit({
      // @ts-expect-error: To Be added
      context: {},
      subscriber: {
        id: 'namaste.business',
        uniqueKeyId: '65aa68decc37a03af525dfb6',
        privateKey:
          '+gwIa9iD4VcVlboJn7xQGukc1Ws95NQ49ekQfc7LcX2YYER/u882nYOh9pz28j4JPQLXj8TG170cT5FZO0wIiA==',
      },
    });
  }

  @RabbitHandler('on_confirm')
  async confirmOndcGateway({}: OnSearchPayload) {
    await this.ondcService.onConfirm({
      // @ts-expect-error: To Be added
      context: {},
      subscriber: {
        id: 'namaste.business',
        uniqueKeyId: '65aa68decc37a03af525dfb6',
        privateKey:
          '+gwIa9iD4VcVlboJn7xQGukc1Ws95NQ49ekQfc7LcX2YYER/u882nYOh9pz28j4JPQLXj8TG170cT5FZO0wIiA==',
      },
    });
  }

  @RabbitHandler('on_track')
  async trackOndcGateway({}: OnSearchPayload) {
    await this.ondcService.onConfirm({
      // @ts-expect-error: To Be added
      context: {},
      subscriber: {
        id: 'namaste.business',
        uniqueKeyId: '65aa68decc37a03af525dfb6',
        privateKey:
          '+gwIa9iD4VcVlboJn7xQGukc1Ws95NQ49ekQfc7LcX2YYER/u882nYOh9pz28j4JPQLXj8TG170cT5FZO0wIiA==',
      },
    });
  }

  @RabbitHandler('on_cancel')
  async cancelOndcGateway({}: OnSearchPayload) {
    await this.ondcService.onCancel({
      // @ts-expect-error: To Be added
      context: {},
      subscriber: {
        id: 'namaste.business',
        uniqueKeyId: '65aa68decc37a03af525dfb6',
        privateKey:
          '+gwIa9iD4VcVlboJn7xQGukc1Ws95NQ49ekQfc7LcX2YYER/u882nYOh9pz28j4JPQLXj8TG170cT5FZO0wIiA==',
      },
    });
  }

  @RabbitHandler('on_update')
  async updateOndcGateway({}: OnSearchPayload) {
    await this.ondcService.onUpdate({
      // @ts-expect-error: To Be added
      context: {},
      subscriber: {
        id: 'namaste.business',
        uniqueKeyId: '65aa68decc37a03af525dfb6',
        privateKey:
          '+gwIa9iD4VcVlboJn7xQGukc1Ws95NQ49ekQfc7LcX2YYER/u882nYOh9pz28j4JPQLXj8TG170cT5FZO0wIiA==',
      },
    });
  }

  @RabbitHandler('on_status')
  async statusOndcGateway({}: OnSearchPayload) {
    await this.ondcService.onStatus({
      // @ts-expect-error: To Be added
      context: {},
      subscriber: {
        id: 'namaste.business',
        uniqueKeyId: '65aa68decc37a03af525dfb6',
        privateKey:
          '+gwIa9iD4VcVlboJn7xQGukc1Ws95NQ49ekQfc7LcX2YYER/u882nYOh9pz28j4JPQLXj8TG170cT5FZO0wIiA==',
      },
    });
  }

  @RabbitHandler('on_rating')
  async ratingOndcGateway({}: OnSearchPayload) {
    await this.ondcService.onRating({
      // @ts-expect-error: To Be added
      context: {},
      subscriber: {
        id: 'namaste.business',
        uniqueKeyId: '65aa68decc37a03af525dfb6',
        privateKey:
          '+gwIa9iD4VcVlboJn7xQGukc1Ws95NQ49ekQfc7LcX2YYER/u882nYOh9pz28j4JPQLXj8TG170cT5FZO0wIiA==',
      },
    });
  }

  @RabbitHandler('on_support')
  async supportOndcGateway({}: OnSearchPayload) {
    await this.ondcService.onSupport({
      // @ts-expect-error: To Be added
      context: {},
      subscriber: {
        id: 'namaste.business',
        uniqueKeyId: '65aa68decc37a03af525dfb6',
        privateKey:
          '+gwIa9iD4VcVlboJn7xQGukc1Ws95NQ49ekQfc7LcX2YYER/u882nYOh9pz28j4JPQLXj8TG170cT5FZO0wIiA==',
      },
    });
  }
}
