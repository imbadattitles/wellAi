import { apiSuccess } from '@wellllai/contracts';
import { describe, expect, it, vi } from 'vitest';
import { ServiceHttpClient, ServiceHttpError } from '../application/service-http.client';
import { ServiceUrls } from '../application/service-urls';
import { LearningGatewayController } from './learning.controller';

describe('LearningGatewayController', () => {
  it('marks the owned program failed when knowledge upload fails', async () => {
    const program = {
      id: 'ea5655d4-248b-4f9d-a846-d6eab73f03ff',
      sourceId: 'a65f7855-14b3-4ce4-bc86-5fe472527a4d',
      status: 'pending',
    };
    const http = {
      json: vi
        .fn()
        .mockResolvedValueOnce(apiSuccess(program))
        .mockResolvedValueOnce(apiSuccess({ ...program, status: 'failed' })),
      multipart: vi
        .fn()
        .mockRejectedValue(new ServiceHttpError(422, 'INVALID_PDF_DOCUMENT', 'The PDF is invalid')),
    } as unknown as ServiceHttpClient;
    const urls = {
      learning: 'http://learning',
      knowledge: 'http://knowledge',
    } as unknown as ServiceUrls;
    const controller = new LearningGatewayController(http, urls, {} as never);
    const file = {
      originalname: 'notes.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('%PDF-test'),
    } as Express.Multer.File;

    await expect(
      controller.createFromDocument(
        '79da53cb-b115-444d-b9a1-fcad3e43bca5',
        { title: 'Notes', language: 'ru' },
        file,
      ),
    ).rejects.toMatchObject({ downstreamCode: 'INVALID_PDF_DOCUMENT' });

    expect(http.json).toHaveBeenNthCalledWith(
      2,
      `http://learning/internal/programs/${program.id}/document-upload-failed`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          userId: '79da53cb-b115-444d-b9a1-fcad3e43bca5',
          sourceId: program.sourceId,
          errorCode: 'INVALID_PDF_DOCUMENT',
        }),
      }),
    );
  });
});
