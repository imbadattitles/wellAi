import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { apiSuccess } from '@wellllai/contracts';
import { LearningApplicationService } from '../application/learning.service';
import {
  AskQuestionDto,
  CreateDocumentProgramDto,
  CreateTopicProgramDto,
  GenerateQuizDto,
  MarkDocumentUploadFailedDto,
  OwnedProgramQueryDto,
  SubmitAnswerDto,
} from './dto';

@Controller('internal')
export class LearningController {
  constructor(private readonly learning: LearningApplicationService) {}

  @Post('programs/topic')
  async createTopic(@Body() dto: CreateTopicProgramDto) {
    return apiSuccess(await this.learning.createTopicProgram(dto));
  }

  @Post('programs/document')
  async createDocument(@Body() dto: CreateDocumentProgramDto) {
    return apiSuccess(await this.learning.createDocumentProgram(dto));
  }

  @Post('programs/:programId/document-upload-failed')
  async markDocumentUploadFailed(
    @Param('programId', new ParseUUIDPipe()) programId: string,
    @Body() dto: MarkDocumentUploadFailedDto,
  ) {
    return apiSuccess(await this.learning.markDocumentUploadFailed({ programId, ...dto }));
  }

  @Get('programs/:programId')
  async getProgram(
    @Param('programId', new ParseUUIDPipe()) programId: string,
    @Query() query: OwnedProgramQueryDto,
  ) {
    return apiSuccess(await this.learning.getProgram(programId, query.userId));
  }

  @Get('programs/:programId/progress')
  async getProgress(
    @Param('programId', new ParseUUIDPipe()) programId: string,
    @Query() query: OwnedProgramQueryDto,
  ) {
    return apiSuccess(await this.learning.getProgress(programId, query.userId));
  }

  @Post('programs/:programId/questions')
  async ask(
    @Param('programId', new ParseUUIDPipe()) programId: string,
    @Body() dto: AskQuestionDto,
  ) {
    return apiSuccess(await this.learning.answerQuestion({ programId, ...dto }));
  }

  @Post('programs/:programId/quizzes')
  async generateQuiz(
    @Param('programId', new ParseUUIDPipe()) programId: string,
    @Body() dto: GenerateQuizDto,
  ) {
    return apiSuccess(await this.learning.generateQuiz({ programId, ...dto }));
  }

  @Post('questions/:questionId/attempts')
  async submitAnswer(
    @Param('questionId', new ParseUUIDPipe()) questionId: string,
    @Body() dto: SubmitAnswerDto,
  ) {
    return apiSuccess(await this.learning.submitAnswer({ questionId, ...dto }));
  }
}
