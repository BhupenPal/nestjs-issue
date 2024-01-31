import { Module } from '@nestjs/common';
import { OndcModule } from '@integrations/ondc';
import { ParticipantModule } from '@root/participant/participant.module';
import { SellerController } from './seller.controller';

@Module({
  imports: [OndcModule, ParticipantModule],
  controllers: [SellerController],
})
export class SellerModule {}
