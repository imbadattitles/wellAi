import { Injectable } from '@nestjs/common';
import { ApiEnvelope, ApiError, apiSuccess } from '@wellllai/contracts';

export const DOWNSTREAM_DEADLINE_MS = 45_000;

function readSafeDownstreamError(body: unknown, status: number): ApiError {
  const fallback: ApiError = {
    code: `DOWNSTREAM_HTTP_${status}`,
    message: status >= 500 ? 'Downstream service failed' : 'Downstream request failed',
  };
  if (!body || typeof body !== 'object' || !('error' in body)) return fallback;

  const error = (body as { error?: unknown }).error;
  if (!error || typeof error !== 'object') return fallback;
  const rawCode = (error as { code?: unknown }).code;
  const rawMessage = (error as { message?: unknown }).message;
  if (
    typeof rawCode !== 'string' ||
    !/^[A-Za-z0-9_.:-]{1,80}$/.test(rawCode) ||
    typeof rawMessage !== 'string'
  ) {
    return fallback;
  }

  const message = rawMessage
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
  return message ? { code: rawCode, message } : fallback;
}

export class ServiceHttpError extends Error {
  constructor(
    readonly status: number,
    readonly downstreamCode: string,
    message: string,
  ) {
    super(message);
    this.name = 'ServiceHttpError';
  }
}

@Injectable()
export class ServiceHttpClient {
  async json<T>(url: string, init?: RequestInit): Promise<ApiEnvelope<T>> {
    const headers = new Headers(init?.headers);
    if (!headers.has('content-type')) headers.set('content-type', 'application/json');
    const response = await fetch(url, {
      ...init,
      headers,
      // OpenAI-backed synchronous calls use a 30 second provider deadline.
      signal: init?.signal ?? AbortSignal.timeout(DOWNSTREAM_DEADLINE_MS),
    });
    return this.read<T>(response);
  }

  async multipart<T>(url: string, body: FormData): Promise<ApiEnvelope<T>> {
    const response = await fetch(url, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(DOWNSTREAM_DEADLINE_MS),
    });
    return this.read<T>(response);
  }

  private async read<T>(response: Response): Promise<ApiEnvelope<T>> {
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const error = readSafeDownstreamError(body, response.status);
      throw new ServiceHttpError(response.status, error.code, error.message);
    }

    if (body && typeof body === 'object' && 'data' in body && 'meta' in body && 'error' in body) {
      return body as ApiEnvelope<T>;
    }
    return apiSuccess(body as T);
  }
}
