import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiEnvelope, apiSuccess } from '@wellllai/contracts';
import { UploadDocumentUseCase } from '../../application/upload-document.use-case';
import { UploadDocumentDto } from './dto/upload-document.dto';

interface UploadDocumentResponse {
  sourceId: string;
  status: 'pending' | 'processing' | 'ready' | 'failed';
}

@Controller()
export class KnowledgeController {
  constructor(private readonly uploadDocument: UploadDocumentUseCase) {}

  @Post('/internal/documents')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 25 * 1_024 * 1_024, files: 1 },
    }),
  )
  async upload(
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('traceparent') traceparent: string | undefined,
  ): Promise<ApiEnvelope<UploadDocumentResponse>> {
    if (!file) throw new BadRequestException('A PDF file is required');

    const source = await this.uploadDocument.execute({
      sourceId: dto.sourceId,
      programId: dto.programId,
      userId: dto.userId,
      language: dto.language,
      fileName: file.originalname,
      mimeType: file.mimetype,
      data: file.buffer,
      idempotencyKey: idempotencyKey ?? dto.sourceId,
      correlationId: dto.sourceId,
      traceparent: traceparent ?? null,
    });

    return apiSuccess({ sourceId: source.id, status: source.status });
  }
}
