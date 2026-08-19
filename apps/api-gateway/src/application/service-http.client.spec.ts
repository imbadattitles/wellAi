import { afterEach, describe, expect, it, vi } from 'vitest';
import { DOWNSTREAM_DEADLINE_MS, ServiceHttpClient, ServiceHttpError } from './service-http.client';

describe('ServiceHttpClient', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('propagates only a bounded downstream envelope code and message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: null,
            meta: {},
            error: {
              code: 'INVALID_PDF_DOCUMENT',
              message: 'Invalid\nPDF',
              details: { stack: 'must not escape' },
            },
          }),
          { status: 422, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );

    const error = await new ServiceHttpClient()
      .json('http://knowledge/internal/documents')
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ServiceHttpError);
    expect(error).toMatchObject({
      status: 422,
      downstreamCode: 'INVALID_PDF_DOCUMENT',
      message: 'Invalid PDF',
    });
    expect(error).not.toHaveProperty('body');
    expect(error).not.toHaveProperty('details');
  });

  it('uses a gateway deadline longer than the synchronous OpenAI deadline', () => {
    expect(DOWNSTREAM_DEADLINE_MS).toBeGreaterThan(30_000);
  });
});
