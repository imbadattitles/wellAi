import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { InterviewApplicationService } from '../application/interview.service';
import { CreateInterviewDto, GetInterviewQueryDto, SubmitInterviewAnswerDto } from './dto';

@Controller('internal/interviews')
export class InterviewController {
  constructor(private readonly interviews: InterviewApplicationService) {}

  @Post()
  create(@Body() dto: CreateInterviewDto) {
    return this.interviews.create(dto);
  }

  @Get(':sessionId')
  get(
    @Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string,
    @Query() query: GetInterviewQueryDto,
  ) {
    return this.interviews.get(sessionId, query.userId);
  }

  @Post(':sessionId/answers')
  submitAnswer(
    @Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string,
    @Body() dto: SubmitInterviewAnswerDto,
  ) {
    return this.interviews.submitAnswer({
      sessionId,
      userId: dto.userId,
      answerId: dto.answerId,
      expectedQuestionIndex: dto.expectedQuestionIndex,
      answer: dto.answer,
    });
  }
}
