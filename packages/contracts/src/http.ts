export interface ApiMeta {
  requestId?: string;
  [key: string]: unknown;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiEnvelope<T> {
  data: T | null;
  meta: ApiMeta;
  error: ApiError | null;
}

export function apiSuccess<T>(data: T, meta: ApiMeta = {}): ApiEnvelope<T> {
  return { data, meta, error: null };
}
