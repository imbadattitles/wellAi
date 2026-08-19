import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { createRedisClient } from '@wellllai/platform';
import { ServiceHttpClient } from './application/service-http.client';
import { ServiceUrls } from './application/service-urls';
import { RateLimitGuard, REDIS_CLIENT } from './infrastructure/rate-limit.guard';
import { HealthController } from './presentation/health.controller';
import { InterviewGatewayController } from './presentation/interview.controller';
import { LearningGatewayController } from './presentation/learning.controller';

@Module({
  controllers: [HealthController, LearningGatewayController, InterviewGatewayController],
  providers: [
    ServiceHttpClient,
    ServiceUrls,
    {
      provide: REDIS_CLIENT,
      useFactory: () => createRedisClient(process.env.REDIS_URL ?? 'redis://localhost:6379'),
    },
    { provide: APP_GUARD, useClass: RateLimitGuard },
  ],
})
export class AppModule {}
