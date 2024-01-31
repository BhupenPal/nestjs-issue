import { Body, Controller, Post } from '@nestjs/common';
import { OndcService } from '@integrations/ondc';
import { ParticipantService } from '@root/participant/participant.service';
import { SearchOndc } from './dto/controller/search.dto';
import { SupportOndc } from './dto/controller/support.dto';
import { RatingOndc } from './dto/controller/rating.dto';
import { UpdateOndc } from './dto/controller/update.dto';
import { CancelOndc } from './dto/controller/cancel.dto';
import { SelectOndc } from './dto/controller/select.dto';
import { InitOndc } from './dto/controller/init.dto';
import { ConfirmOndc } from './dto/controller/confirm.dto';
import { TrackOndc } from './dto/controller/track.dto';

@Controller('sellers')
export class SellerController {
  constructor(
    private readonly ondcService: OndcService,
    private readonly participantService: ParticipantService,
  ) {}

  @Post('search')
  async searchOndcGateway(@Body() { searchQuery, subscriberId }: SearchOndc) {
    const participant =
      await this.participantService.findNetworkParticipantBySubscriberId(
        subscriberId,
      );

    const ondcResponse = await this.ondcService.searchEntities({
      searchQuery,
      categoryId: '',
      categoryName: '',
      providerId: '',
      providerName: '',
      subscriberId: participant.subscriberId,
      subscriberPrivateKey: participant.keyPairs.signingPrivateKey,
      subscriberUniqueKeyId: participant.uniqueKeyId,
    });

    return ondcResponse;
  }

  @Post('select')
  async selectOndcGateway(@Body() { subscriberId }: SelectOndc) {
    const participant =
      await this.participantService.findNetworkParticipantBySubscriberId(
        subscriberId,
      );

    const ondcResponse = await this.ondcService.selectEntities({
      order: {
        fulfillments: [],
        items: [],
        locationId: '',
        providerId: '',
      },
      subscriberId: participant.subscriberId,
      subscriberPrivateKey: participant.keyPairs.signingPrivateKey,
      subscriberUniqueKeyId: participant.uniqueKeyId,
    });

    return ondcResponse;
  }

  @Post('init')
  async initOndc(@Body() { subscriberId }: InitOndc) {
    const participant =
      await this.participantService.findNetworkParticipantBySubscriberId(
        subscriberId,
      );

    const ondcResponse = await this.ondcService.init({
      fulfillments: [],
      items: [],
      locationId: '',
      providerId: '',
      subscriberId: participant.subscriberId,
      subscriberPrivateKey: participant.keyPairs.signingPrivateKey,
      subscriberUniqueKeyId: participant.uniqueKeyId,
    });

    return ondcResponse;
  }

  @Post('confirm')
  async confirmOndc(@Body() { subscriberId }: ConfirmOndc) {
    const participant =
      await this.participantService.findNetworkParticipantBySubscriberId(
        subscriberId,
      );

    const ondcResponse = await this.ondcService.confirm({
      subscriberId: participant.subscriberId,
      subscriberPrivateKey: participant.keyPairs.signingPrivateKey,
      subscriberUniqueKeyId: participant.uniqueKeyId,
    });

    return ondcResponse;
  }

  @Post('track')
  async trackOndc(@Body() { subscriberId, orderId }: TrackOndc) {
    const participant =
      await this.participantService.findNetworkParticipantBySubscriberId(
        subscriberId,
      );

    const ondcResponse = await this.ondcService.track({
      orderId,
      subscriberId: participant.subscriberId,
      subscriberPrivateKey: participant.keyPairs.signingPrivateKey,
      subscriberUniqueKeyId: participant.uniqueKeyId,
    });

    return ondcResponse;
  }

  @Post('cancel')
  async cancelOndc(@Body() { subscriberId, orderId }: CancelOndc) {
    const participant =
      await this.participantService.findNetworkParticipantBySubscriberId(
        subscriberId,
      );

    const ondcResponse = await this.ondcService.cancel({
      orderId,
      subscriberId: participant.subscriberId,
      subscriberPrivateKey: participant.keyPairs.signingPrivateKey,
      subscriberUniqueKeyId: participant.uniqueKeyId,
    });

    return ondcResponse;
  }

  @Post('update')
  async updateOndc(@Body() { subscriberId, orderId }: UpdateOndc) {
    const participant =
      await this.participantService.findNetworkParticipantBySubscriberId(
        subscriberId,
      );

    const ondcResponse = await this.ondcService.update({
      orderId,
      subscriberId: participant.subscriberId,
      subscriberPrivateKey: participant.keyPairs.signingPrivateKey,
      subscriberUniqueKeyId: participant.uniqueKeyId,
    });

    return ondcResponse;
  }

  @Post('rating')
  async ratingOndc(@Body() { subscriberId }: RatingOndc) {
    const participant =
      await this.participantService.findNetworkParticipantBySubscriberId(
        subscriberId,
      );

    const ondcResponse = await this.ondcService.rating({
      subscriberId: participant.subscriberId,
      subscriberPrivateKey: participant.keyPairs.signingPrivateKey,
      subscriberUniqueKeyId: participant.uniqueKeyId,
    });

    return ondcResponse;
  }

  @Post('support')
  async supportOndcGateway(@Body() { subscriberId }: SupportOndc) {
    const participant =
      await this.participantService.findNetworkParticipantBySubscriberId(
        subscriberId,
      );

    const ondcResponse = await this.ondcService.support({
      subscriberId: participant.subscriberId,
      subscriberPrivateKey: participant.keyPairs.signingPrivateKey,
      subscriberUniqueKeyId: participant.uniqueKeyId,
    });

    return ondcResponse;
  }
}
