import { apiSuccess } from '@wellllai/contracts';
import { describe, expect, it, vi } from 'vitest';
import { ServiceHttpClient, ServiceHttpError } from './service-http.client';
import { ServiceUrls } from './service-urls';
import { StatusSignalBus } from './status-signal.bus';
import { StatusStreamService } from './status-stream.service';

describe('StatusStreamService', () => {
  it('sends an immediate snapshot and refreshes only for the matching resource', async () => {
    const programId = 'ea5655d4-248b-4f9d-a846-d6eab73f03ff';
    const userId = '79da53cb-b115-444d-b9a1-fcad3e43bca5';
    const http = {
      json: vi
        .fn()
        .mockResolvedValueOnce(apiSuccess({ id: programId, status: 'processing' }))
        .mockResolvedValueOnce(apiSuccess({ id: programId, status: 'ready' })),
    } as unknown as ServiceHttpClient;
    const urls = { learning: 'http://learning' } as ServiceUrls;
    const bus = new StatusSignalBus();
    const service = new StatusStreamService(http, urls, bus);
    const events: Array<{ type?: string; data: unknown }> = [];
    const subscription = service
      .learningProgram(programId, userId)
      .subscribe((event) => events.push(event));

    await vi.waitFor(() => expect(events).toHaveLength(1));
    bus.publish({
      resource: 'interview-session',
      resourceId: programId,
      eventId: 'd90c3f4a-e04a-4fc1-b76b-bf13810bcf47',
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(http.json).toHaveBeenCalledTimes(1);

    bus.publish({
      resource: 'learning-program',
      resourceId: programId,
      eventId: '46d40467-60ee-436a-a106-eed62eb48fd1',
    });
    await vi.waitFor(() => expect(events).toHaveLength(2));

    expect(events.map((event) => event.data)).toEqual([
      { id: programId, status: 'processing' },
      { id: programId, status: 'ready' },
    ]);
    expect(http.json).toHaveBeenLastCalledWith(
      `http://learning/internal/programs/${programId}?userId=${userId}`,
    );
    subscription.unsubscribe();
  });

  it('closes with an SSE error event when the canonical state cannot be loaded', async () => {
    const http = {
      json: vi.fn().mockRejectedValue(new ServiceHttpError(503, 'LEARNING_UNAVAILABLE', 'offline')),
    } as unknown as ServiceHttpClient;
    const service = new StatusStreamService(
      http,
      { learning: 'http://learning' } as ServiceUrls,
      new StatusSignalBus(),
    );
    const events: Array<{ type?: string; data: unknown }> = [];
    const completed = vi.fn();
    const failed = vi.fn();

    service
      .learningProgram(
        'ea5655d4-248b-4f9d-a846-d6eab73f03ff',
        '79da53cb-b115-444d-b9a1-fcad3e43bca5',
      )
      .subscribe({
        next: (event) => events.push(event),
        complete: completed,
        error: failed,
      });

    await vi.waitFor(() => expect(completed).toHaveBeenCalledOnce());
    expect(failed).not.toHaveBeenCalled();
    expect(events).toEqual([
      {
        type: 'stream-error',
        data: {
          code: 'LEARNING_UNAVAILABLE',
          message: 'Could not refresh resource state',
        },
      },
    ]);
  });
});
