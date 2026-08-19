import { Injectable } from '@nestjs/common';
import { filter, Observable, Subject } from 'rxjs';

export type StatusResource = 'learning-program' | 'interview-session';

export interface StatusSignal {
  resource: StatusResource;
  resourceId: string;
  eventId: string;
}

@Injectable()
export class StatusSignalBus {
  private readonly signals = new Subject<StatusSignal>();

  publish(signal: StatusSignal): void {
    this.signals.next(signal);
  }

  watch(resource: StatusResource, resourceId: string): Observable<StatusSignal> {
    return this.signals.pipe(
      filter((signal) => signal.resource === resource && signal.resourceId === resourceId),
    );
  }
}
