import { OnApplicationShutdown } from '@nestjs/common';
import { Pool } from 'pg';

export class PostgresLifecycle implements OnApplicationShutdown {
  constructor(private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
