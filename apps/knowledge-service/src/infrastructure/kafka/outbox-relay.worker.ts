import { Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { KafkaEventPublisher, PgOutboxRelay } from '@wellllai/platform';

export class OutboxRelayWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelayWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private publishing = false;

  constructor(
    private readonly relay: PgOutboxRelay,
    private readonly publisher: KafkaEventPublisher,
    private readonly pollIntervalMs: number,
  ) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.tick(), this.pollIntervalMs);
    void this.tick();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.publisher.disconnect();
  }

  private async tick(): Promise<void> {
    if (this.publishing) return;
    this.publishing = true;
    try {
      await this.relay.publishBatch();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown outbox error';
      this.logger.error(`Outbox publish failed: ${message}`);
    } finally {
      this.publishing = false;
    }
  }
}
