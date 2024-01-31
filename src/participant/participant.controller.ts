import {
  Body,
  Controller,
  InternalServerErrorException,
  Post,
} from '@nestjs/common';
import { OndcService } from '@integrations/ondc';
import { SubscribeBody } from './dto/controller/subscribe.dto';
import { ParticipantCache } from './participant.cache';
import { ParticipantService } from './participant.service';
import { LookupBody } from './dto/controller/lookup.dto';

@Controller('participants')
export class ParticipantController {
  constructor(
    private readonly participantService: ParticipantService,
    private readonly ondcService: OndcService,
    private readonly participantCache: ParticipantCache,
  ) {}

  @Post('subscribe')
  async registerMerchantToOndc(@Body() { registerFor, entity }: SubscribeBody) {
    const keys = await this.ondcService.generateSigningAndEncryptionKeyPairs();
    const idCode = await this.ondcService.generateRequestId({
      privateKey: keys.signingPrivateKey,
    });

    await this.participantCache.setOndcVerificationCode({
      requestId: idCode.signedRequestId,
    });

    const participant = await this.participantService.createNetworkParticipant({
      subscriberId: entity.subscriberId,
      keyPairs: keys,
      requestId: idCode.requestId,
    });

    const ondcResponse = await this.ondcService.subscribe({
      requestId: idCode.requestId,
      registerFor,
      entity,
      uniqueKeyId: participant._id.toString(),
      keyPairs: keys,
    });

    if (!ondcResponse) {
      // @TODO: handle network participant deletion
      throw new InternalServerErrorException();
    }

    await this.participantCache.unsetOndcVerificationCode();

    return ondcResponse.response.data;
  }

  @Post('lookup')
  async findMerchantInOndcRegistry(
    @Body()
    { subscriberId, uniqueKeyId, country, city, domain, type }: LookupBody,
  ) {
    const ondcResponse = await this.ondcService.registryLookup({
      subscriberId,
      uniqueKeyId,
      country,
      city,
      domain,
      type,
    });

    return ondcResponse;
  }
}
