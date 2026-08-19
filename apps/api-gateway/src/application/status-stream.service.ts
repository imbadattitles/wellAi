import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ServiceHttpClient, ServiceHttpError } from './service-http.client';
import { ServiceUrls } from './service-urls';
import { StatusResource, StatusSignalBus } from './status-signal.bus';

const HEARTBEAT_INTERVAL_MS = 15_000;

@Injectable()
export class StatusStreamService {
  constructor(
    private readonly http: ServiceHttpClient,
    private readonly urls: ServiceUrls,
    private readonly signals: StatusSignalBus,
  ) {}

  learningProgram(programId: string, userId: string): Observable<MessageEvent> {
    const url = `${this.urls.learning}/internal/programs/${encodeURIComponent(programId)}?userId=${encodeURIComponent(userId)}`;
    return this.createStream('learning-program', programId, () => this.load(url));
  }

  interviewSession(sessionId: string, userId: string): Observable<MessageEvent> {
    const url = `${this.urls.interview}/internal/interviews/${encodeURIComponent(sessionId)}?userId=${encodeURIComponent(userId)}`;
    return this.createStream('interview-session', sessionId, () => this.load(url));
  }

  private createStream(
    resource: StatusResource,
    resourceId: string,
    loadSnapshot: () => Promise<Record<string, unknown>>,
  ): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      let active = true;
      let lastSnapshot = '';
      let refreshQueue = Promise.resolve();

      const scheduleRefresh = (eventId?: string) => {
        refreshQueue = refreshQueue
          .then(async () => {
            if (!active) return;
            const data = await loadSnapshot();
            if (!active) return;
            const fingerprint = JSON.stringify(data);
            if (fingerprint === lastSnapshot) return;
            lastSnapshot = fingerprint;

            const event: MessageEvent = {
              type: 'state',
              retry: 2_000,
              data,
            };
            if (eventId) event.id = eventId;
            subscriber.next(event);
          })
          .catch((error: unknown) => {
            if (!active) return;
            const code =
              error instanceof ServiceHttpError ? error.downstreamCode : 'STATUS_REFRESH_FAILED';
            subscriber.next({
              type: 'stream-error',
              data: { code, message: 'Could not refresh resource state' },
            });
            subscriber.complete();
          });
      };

      // Subscribe before the first read so a state change during that read is queued.
      const signalSubscription = this.signals
        .watch(resource, resourceId)
        .subscribe((signal) => scheduleRefresh(signal.eventId));
      scheduleRefresh();

      const heartbeat = setInterval(() => {
        if (active) {
          subscriber.next({
            type: 'heartbeat',
            data: { occurredAt: new Date().toISOString() },
          });
        }
      }, HEARTBEAT_INTERVAL_MS);

      return () => {
        active = false;
        clearInterval(heartbeat);
        signalSubscription.unsubscribe();
      };
    });
  }

  private async load(url: string): Promise<Record<string, unknown>> {
    const response = await this.http.json<unknown>(url);
    if (response.data === null || typeof response.data !== 'object') {
      throw new ServiceHttpError(502, 'DOWNSTREAM_EMPTY_RESPONSE', 'Downstream returned no state');
    }
    return response.data as Record<string, unknown>;
  }
}
