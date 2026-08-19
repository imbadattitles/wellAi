import { z } from 'zod';
import { OpenAiRequestError } from '../../domain/errors';

export interface OpenAiHttpClientOptions {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
}

export class OpenAiHttpClient {
  constructor(private readonly options: OpenAiHttpClientOptions) {}

  async post<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.options.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.options.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.options.timeoutMs),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'OpenAI request failed';
      throw new OpenAiRequestError(message, true);
    }

    if (!response.ok) {
      const requestId = response.headers.get('x-request-id');
      throw new OpenAiRequestError(
        `OpenAI returned HTTP ${response.status}${requestId ? ` (${requestId})` : ''}`,
        response.status === 408 ||
          response.status === 409 ||
          response.status === 429 ||
          response.status >= 500,
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new OpenAiRequestError('OpenAI returned a non-JSON response', true);
    }

    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      throw new OpenAiRequestError('OpenAI returned an unexpected response shape', false);
    }
    return parsed.data;
  }
}
