import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { EnvService } from '@libs/environment';
import { OndcService } from '@integrations/ondc';
import { OnSubscribeHook } from './dto/hook/on-subscribe-hook.dto';
import { ParticipantService } from './participant.service';

@Controller('participants/hook')
export class ParticipantHook {
  constructor(
    private readonly envService: EnvService,
    private readonly participantService: ParticipantService,
    private readonly ondcService: OndcService,
  ) {}

  @Post('on_subscribe')
  @HttpCode(200)
  async onSubscribeHook(@Body() { challenge, subscriber_id }: OnSubscribeHook) {
    const participant =
      await this.participantService.findNetworkParticipantBySubscriberId(
        subscriber_id,
      );

    await this.participantService.saveWebhookPayload({
      challenge,
      subscriberId: subscriber_id,
    });

    const answer = await this.ondcService.solveWebhookChallenge({
      challenge: challenge,
      ondcRegistryPublicKey: this.envService.get('ONDC_REGISTRY_PUBLIC_KEY'),
      privateKey: participant.keyPairs.encryptionPrivateKey,
    });

    await this.participantService.saveWebhookResponse({
      answer,
      subscriberId: subscriber_id,
    });

    return { answer };
  }
}
