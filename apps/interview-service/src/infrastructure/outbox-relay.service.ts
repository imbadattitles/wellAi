import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { KafkaEventPublisher, PgOutboxRelay, readKafkaBrokers } from '@wellllai/platform';
import { Pool } from 'pg';
import { POSTGRES_POOL } from '../application/ports';

@Injectable()
export class OutboxRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly publisher: KafkaEventPublisher;
  private readonly relay: PgOutboxRelay;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(@Inject(POSTGRES_POOL) pool: Pool) {
    const brokers = readKafkaBrokers();
    this.publisher = new KafkaEventPublisher('interview-outbox', brokers);
    this.relay = new PgOutboxRelay(pool, 'interview', this.publisher);
  }

  onModuleInit(): void {
    this.timer = setInterval(() => void this.flush(), 1_000);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.publisher.disconnect();
  }

  private async flush(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.relay.publishBatch();
    } catch (error) {
      console.error('Interview outbox relay failed', error);
    } finally {
      this.running = false;
    }
  }
}
