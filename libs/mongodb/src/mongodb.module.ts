import { EnvModule, EnvService } from '@libs/environment';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [EnvModule],
      useFactory: async (envService: EnvService) => ({
        uri: envService.get('MONGO_URL'),
      }),
      inject: [EnvService],
    }),
  ],
})
export class MongodbModule {}
