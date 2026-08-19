import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { RedisClient } from '@wellllai/platform';
import { StatusSignal, StatusSignalBus } from '../application/status-signal.bus';
import { REDIS_CLIENT } from './rate-limit.guard';

export const STATUS_REDIS_CHANNEL = 'wellllai:gateway:status:v1';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseStatusSignal(value: string): StatusSignal | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return null;
    const candidate = parsed as Partial<StatusSignal>;
    if (candidate.resource !== 'learning-program' && candidate.resource !== 'interview-session') {
      return null;
    }
    if (
      typeof candidate.resourceId !== 'string' ||
      !UUID_PATTERN.test(candidate.resourceId) ||
      typeof candidate.eventId !== 'string' ||
      !UUID_PATTERN.test(candidate.eventId)
    ) {
      return null;
    }
    return candidate as StatusSignal;
  } catch {
    return null;
  }
}

@Injectable()
export class StatusRedisBridge implements OnModuleInit, OnModuleDestroy {
  private subscriber: RedisClient | null = null;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: RedisClient,
    private readonly bus: StatusSignalBus,
  ) {}

  async onModuleInit(): Promise<void> {
    this.subscriber = this.redis.duplicate();
    this.subscriber.on('error', (error) => {
      console.error('Status Redis subscriber error', error);
    });
    await this.subscriber.connect();
    await this.subscriber.subscribe(STATUS_REDIS_CHANNEL, (message) => {
      const signal = parseStatusSignal(message);
      if (signal) this.bus.publish(signal);
    });
  }

  async publish(signal: StatusSignal): Promise<void> {
    await this.redis.publish(STATUS_REDIS_CHANNEL, JSON.stringify(signal));
  }

  async onModuleDestroy(): Promise<void> {
    if (this.subscriber?.isOpen) await this.subscriber.quit();
  }
}
