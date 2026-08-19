import { Injectable } from '@nestjs/common';

@Injectable()
export class ServiceUrls {
  readonly knowledge = process.env.KNOWLEDGE_SERVICE_URL ?? 'http://localhost:3011';
  readonly learning = process.env.LEARNING_SERVICE_URL ?? 'http://localhost:3012';
  readonly interview = process.env.INTERVIEW_SERVICE_URL ?? 'http://localhost:3013';
}
