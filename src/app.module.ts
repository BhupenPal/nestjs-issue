import { Module } from '@nestjs/common';
import { MongodbModule } from '@libs/mongodb';
import { BuyerModule } from '@root/buyer';
import { HealthModule } from '@root/health';
import { ParticipantModule } from '@root/participant';
import { SellerModule } from '@root/seller';

@Module({
  imports: [
    MongodbModule,
    BuyerModule,
    HealthModule,
    ParticipantModule,
    SellerModule,
  ],
})
export class AppModule {}
