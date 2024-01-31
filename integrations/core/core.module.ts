import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { CoreService } from './core.service';

@Module({
  imports: [HttpModule],
  providers: [CoreService],
  exports: [CoreService],
})
export class CoreModule {}
