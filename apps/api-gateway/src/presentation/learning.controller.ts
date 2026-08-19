import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Logger,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Post,
  Sse,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiEnvelope } from '@wellllai/contracts';
import { ServiceHttpClient, ServiceHttpError } from '../application/service-http.client';
import { ServiceUrls } from '../application/service-urls';
import { StatusStreamService } from '../application/status-stream.service';
import {
  AskQuestionDto,
  CreateDocumentProgramDto,
  CreateTopicProgramDto,
  GenerateQuizDto,
  SubmitLearningAnswerDto,
} from './dto';
import { resolveUserId } from './user-id';

interface ProgramCreated {
  id: string;
  sourceId: string;
  status: string;
}

@Controller('v1')
export class LearningGatewayController {
  private readonly logger = new Logger(LearningGatewayController.name);

  constructor(
    private readonly http: ServiceHttpClient,
    private readonly urls: ServiceUrls,
    private readonly statusStreams: StatusStreamService,
  ) {}

  @Post('learning-programs/from-topic')
  createFromTopic(
    @Headers('x-user-id') userHeader: string | undefined,
    @Body() dto: CreateTopicProgramDto,
  ) {
    return this.http.json(`${this.urls.learning}/internal/programs/topic`, {
      method: 'POST',
      body: JSON.stringify({ ...dto, userId: resolveUserId(userHeader) }),
    });
  }

  @Post('learning-programs/from-document')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
      fileFilter: (_request, file, callback) => callback(null, file.mimetype === 'application/pdf'),
    }),
  )
  async createFromDocument(
    @Headers('x-user-id') userHeader: string | undefined,
    @Body() dto: CreateDocumentProgramDto,
    @UploadedFile(new ParseFilePipe({ fileIsRequired: true })) file: Express.Multer.File,
  ): Promise<ApiEnvelope<ProgramCreated>> {
    const userId = resolveUserId(userHeader);
    const program = await this.http.json<ProgramCreated>(
      `${this.urls.learning}/internal/programs/document`,
      {
        method: 'POST',
        body: JSON.stringify({
          ...dto,
          userId,
          fileName: file.originalname,
        }),
      },
    );
    if (!program.data) return program;
    const createdProgram = program.data;

    const form = new FormData();
    form.append('programId', createdProgram.id);
    form.append('sourceId', createdProgram.sourceId);
    form.append('userId', userId);
    form.append('language', dto.language);
    form.append(
      'file',
      new Blob([Uint8Array.from(file.buffer)], { type: 'application/pdf' }),
      file.originalname,
    );
    try {
      await this.http.multipart(`${this.urls.knowledge}/internal/documents`, form);
    } catch (error) {
      const errorCode =
        error instanceof ServiceHttpError
          ? error.downstreamCode
          : 'KNOWLEDGE_DOCUMENT_UPLOAD_FAILED';
      try {
        await this.http.json(
          `${this.urls.learning}/internal/programs/${encodeURIComponent(createdProgram.id)}/document-upload-failed`,
          {
            method: 'POST',
            body: JSON.stringify({
              userId,
              sourceId: createdProgram.sourceId,
              errorCode,
            }),
          },
        );
      } catch (compensationError) {
        const message =
          compensationError instanceof Error ? compensationError.message : 'Unknown error';
        this.logger.error(`Could not compensate document program ${createdProgram.id}: ${message}`);
      }
      throw error;
    }
    return program;
  }

  @Get('learning-programs/:programId')
  getProgram(
    @Headers('x-user-id') userHeader: string | undefined,
    @Param('programId', new ParseUUIDPipe({ version: '4' })) programId: string,
  ) {
    const userId = resolveUserId(userHeader);
    return this.http.json(
      `${this.urls.learning}/internal/programs/${encodeURIComponent(programId)}?userId=${userId}`,
    );
  }

  @Sse('learning-programs/:programId/events')
  @Header('X-Accel-Buffering', 'no')
  events(
    @Headers('x-user-id') userHeader: string | undefined,
    @Param('programId', new ParseUUIDPipe({ version: '4' })) programId: string,
  ) {
    return this.statusStreams.learningProgram(programId, resolveUserId(userHeader));
  }

  @Get('learning-programs/:programId/progress')
  getProgress(
    @Headers('x-user-id') userHeader: string | undefined,
    @Param('programId', new ParseUUIDPipe({ version: '4' })) programId: string,
  ) {
    const userId = resolveUserId(userHeader);
    return this.http.json(
      `${this.urls.learning}/internal/programs/${encodeURIComponent(programId)}/progress?userId=${userId}`,
    );
  }

  @Post('learning-programs/:programId/questions')
  askQuestion(
    @Headers('x-user-id') userHeader: string | undefined,
    @Param('programId', new ParseUUIDPipe({ version: '4' })) programId: string,
    @Body() dto: AskQuestionDto,
  ) {
    return this.http.json(
      `${this.urls.learning}/internal/programs/${encodeURIComponent(programId)}/questions`,
      {
        method: 'POST',
        body: JSON.stringify({ ...dto, userId: resolveUserId(userHeader) }),
      },
    );
  }

  @Post('learning-programs/:programId/quizzes')
  generateQuiz(
    @Headers('x-user-id') userHeader: string | undefined,
    @Param('programId', new ParseUUIDPipe({ version: '4' })) programId: string,
    @Body() dto: GenerateQuizDto,
  ) {
    return this.http.json(
      `${this.urls.learning}/internal/programs/${encodeURIComponent(programId)}/quizzes`,
      {
        method: 'POST',
        body: JSON.stringify({ ...dto, userId: resolveUserId(userHeader) }),
      },
    );
  }

  @Post('questions/:questionId/attempts')
  submitAnswer(
    @Headers('x-user-id') userHeader: string | undefined,
    @Param('questionId', new ParseUUIDPipe({ version: '4' })) questionId: string,
    @Body() dto: SubmitLearningAnswerDto,
  ) {
    return this.http.json(
      `${this.urls.learning}/internal/questions/${encodeURIComponent(questionId)}/attempts`,
      {
        method: 'POST',
        body: JSON.stringify({ ...dto, userId: resolveUserId(userHeader) }),
      },
    );
  }
}
