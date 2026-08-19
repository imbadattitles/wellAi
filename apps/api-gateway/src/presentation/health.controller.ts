import { Controller, Get } from '@nestjs/common';
import { apiSuccess } from '@wellllai/contracts';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return apiSuccess({ status: 'ok', service: 'api-gateway' });
  }
}
