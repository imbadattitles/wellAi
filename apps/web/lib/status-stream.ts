import { ApiClientError, buildApiUrl, getAnonymousUserId } from './api-client';

export interface StatusStreamHandlers<T> {
  onOpen?: () => void;
  onState: (state: T) => boolean | void;
  onError?: (error: unknown) => void;
}

interface ParsedSseEvent {
  type: string;
  data: string;
  retry?: number;
}

export interface ParsedSseFrames {
  events: ParsedSseEvent[];
  remainder: string;
}

export function parseSseFrames(input: string): ParsedSseFrames {
  const events: ParsedSseEvent[] = [];
  let remainderStart = 0;
  const delimiter = /\r?\n\r?\n/g;
  let match: RegExpExecArray | null;

  while ((match = delimiter.exec(input))) {
    const frame = input.slice(remainderStart, match.index);
    remainderStart = match.index + match[0].length;

    let type = 'message';
    let retry: number | undefined;
    const data: string[] = [];
    for (const line of frame.split(/\r?\n/)) {
      if (!line || line.startsWith(':')) continue;
      const separator = line.indexOf(':');
      const field = separator === -1 ? line : line.slice(0, separator);
      const rawValue = separator === -1 ? '' : line.slice(separator + 1);
      const value = rawValue.startsWith(' ') ? rawValue.slice(1) : rawValue;

      if (field === 'event') type = value;
      else if (field === 'data') data.push(value);
      else if (field === 'retry' && /^\d+$/.test(value)) retry = Number(value);
    }

    if (data.length > 0) {
      events.push({
        type,
        data: data.join('\n'),
        ...(retry === undefined ? {} : { retry }),
      });
    }
  }

  return { events, remainder: input.slice(remainderStart) };
}

function waitForReconnect(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }

    const timer = window.setTimeout(resolve, milliseconds);
    signal.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

async function responseError(response: Response): Promise<ApiClientError> {
  const body: unknown = await response.json().catch(() => null);
  if (body && typeof body === 'object' && 'error' in body) {
    const error = (body as { error?: { code?: unknown; message?: unknown } }).error;
    if (typeof error?.code === 'string' && typeof error.message === 'string') {
      return new ApiClientError(error.message, error.code, response.status);
    }
  }
  return new ApiClientError(
    'Не удалось открыть поток обновлений.',
    'STATUS_STREAM_ERROR',
    response.status,
  );
}

function subscribeToStatusStream<T>(path: string, handlers: StatusStreamHandlers<T>): () => void {
  const controller = new AbortController();
  let stopped = false;

  void (async () => {
    let reconnectDelay = 1_000;

    while (!stopped) {
      try {
        const response = await fetch(buildApiUrl(path), {
          method: 'GET',
          cache: 'no-store',
          headers: {
            Accept: 'text/event-stream',
            'x-user-id': getAnonymousUserId(),
          },
          signal: controller.signal,
        });
        if (!response.ok) throw await responseError(response);
        if (!response.body) {
          throw new ApiClientError(
            'Браузер не смог прочитать поток обновлений.',
            'STATUS_STREAM_UNAVAILABLE',
          );
        }

        handlers.onOpen?.();
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let streamEnded = false;

        try {
          while (!stopped) {
            const result = await reader.read();
            buffer += decoder.decode(result.value, { stream: !result.done });
            const parsed = parseSseFrames(buffer);
            buffer = parsed.remainder;

            for (const event of parsed.events) {
              if (event.retry !== undefined) {
                reconnectDelay = Math.min(10_000, Math.max(500, event.retry));
              }
              if (event.type === 'stream-error') {
                throw new ApiClientError(
                  'Поток обновлений временно недоступен.',
                  'STATUS_STREAM_REFRESH_FAILED',
                );
              }
              if (event.type !== 'state') continue;

              const keepListening = handlers.onState(JSON.parse(event.data) as T);
              if (keepListening === false) {
                stopped = true;
                controller.abort();
                break;
              }
            }

            if (result.done) {
              streamEnded = true;
              break;
            }
          }
        } finally {
          if (!streamEnded) await reader.cancel().catch(() => undefined);
          reader.releaseLock();
        }
      } catch (error) {
        if (controller.signal.aborted || stopped) return;
        handlers.onError?.(error);
        reconnectDelay = Math.min(10_000, reconnectDelay * 2);
      }

      if (!stopped) await waitForReconnect(reconnectDelay, controller.signal);
    }
  })();

  return () => {
    stopped = true;
    controller.abort();
  };
}

export function subscribeToLearningProgramStates<T>(
  programId: string,
  handlers: StatusStreamHandlers<T>,
): () => void {
  return subscribeToStatusStream(
    `/learning-programs/${encodeURIComponent(programId)}/events`,
    handlers,
  );
}

export function subscribeToInterviewStates<T>(
  sessionId: string,
  handlers: StatusStreamHandlers<T>,
): () => void {
  return subscribeToStatusStream(
    `/interview-programs/${encodeURIComponent(sessionId)}/events`,
    handlers,
  );
}
