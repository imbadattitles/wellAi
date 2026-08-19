import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ServiceHttpClient } from '../application/service-http.client';
import { ServiceUrls } from '../application/service-urls';
import { CreateInterviewDto, SubmitInterviewAnswerDto } from './dto';
import { resolveUserId } from './user-id';

@Controller('v1/interview-programs')
export class InterviewGatewayController {
  constructor(
    private readonly http: ServiceHttpClient,
    private readonly urls: ServiceUrls,
  ) {}

  @Post()
  create(@Headers('x-user-id') userHeader: string | undefined, @Body() dto: CreateInterviewDto) {
    return this.http.json(`${this.urls.interview}/internal/interviews`, {
      method: 'POST',
      body: JSON.stringify({
        ...dto,
        vacancyText: dto.vacancyText || null,
        userId: resolveUserId(userHeader),
      }),
    });
  }

  @Get(':sessionId')
  get(
    @Headers('x-user-id') userHeader: string | undefined,
    @Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string,
  ) {
    const userId = resolveUserId(userHeader);
    return this.http.json(
      `${this.urls.interview}/internal/interviews/${encodeURIComponent(sessionId)}?userId=${userId}`,
    );
  }

  @Post(':sessionId/answers')
  answer(
    @Headers('x-user-id') userHeader: string | undefined,
    @Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string,
    @Body() dto: SubmitInterviewAnswerDto,
  ) {
    return this.http.json(
      `${this.urls.interview}/internal/interviews/${encodeURIComponent(sessionId)}/answers`,
      {
        method: 'POST',
        body: JSON.stringify({
          userId: resolveUserId(userHeader),
          answerId: dto.answerId,
          expectedQuestionIndex: dto.expectedQuestionIndex,
          answer: dto.answer,
        }),
      },
    );
  }
}
