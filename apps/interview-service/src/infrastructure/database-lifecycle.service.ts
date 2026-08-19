import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { Pool } from 'pg';
import { POSTGRES_POOL } from '../application/ports';

@Injectable()
export class DatabaseLifecycleService implements OnApplicationShutdown {
  constructor(@Inject(POSTGRES_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
