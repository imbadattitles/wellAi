import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { Pool } from 'pg';
import { POSTGRES_POOL } from '../application/ports';

@Injectable()
export class PostgresLifecycleService implements OnApplicationShutdown {
  private closed = false;

  constructor(@Inject(POSTGRES_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await this.pool.end();
  }
}
