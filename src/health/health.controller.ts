import { Controller, Get } from '@nestjs/common';

@Controller('health-check')
export class HealthController {
  constructor() {}

  @Get()
  check() {
    return { success: true };
  }
}
