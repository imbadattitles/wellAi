import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Request } from 'express';
import { RedisClient } from '@wellllai/platform';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

export function buildRateLimitKey(request: Request, now = Date.now()): string {
  const ip = request.ip || request.socket.remoteAddress || 'unknown';
  const routePath = typeof request.route?.path === 'string' ? request.route.path : request.path;
  const route = `${request.method}:${request.baseUrl}${routePath}`;
  const fingerprint = createHash('sha256').update(`${ip}\0${route}`).digest('hex').slice(0, 32);
  const window = Math.floor(now / 60_000);
  return `gateway:rate:v1:${fingerprint}:${window}`;
}

@Injectable()
export class RateLimitGuard implements CanActivate, OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClient) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const key = buildRateLimitKey(request);
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, 65);
    if (count > 120) {
      throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis.isOpen) await this.redis.quit();
  }
}
