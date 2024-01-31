import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { EnvModule } from '@libs/environment';
import { OndcService } from './ondc.service';
import { OndcUtilService } from './ondc-util.service';
import { BuyerHookGuard } from './guards';

@Module({
  imports: [EnvModule, HttpModule],
  providers: [OndcService, OndcUtilService, BuyerHookGuard],
  exports: [OndcService, BuyerHookGuard],
})
export class OndcModule {}
