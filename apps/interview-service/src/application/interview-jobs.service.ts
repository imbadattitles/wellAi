import {
  InterviewAiPort,
  InterviewRepository,
  MessageContext,
  PermanentInterviewAiError,
} from './ports';

export class InterviewJobsService {
  constructor(
    private readonly repository: InterviewRepository,
    private readonly ai: InterviewAiPort,
  ) {}

  async generateScenario(context: MessageContext, sessionId: string): Promise<void> {
    if (await this.repository.isMessageProcessed(context.messageId)) return;

    const session = await this.repository.findSession(sessionId);
    if (!session) throw new Error(`Interview session ${sessionId} was not found`);
    if (session.status !== 'scenario_pending') {
      await this.repository.acknowledgeMessage(context.messageId);
      return;
    }

    try {
      const scenario = await this.ai.generateScenario(session);
      if (scenario.questions.length === 0) {
        throw new PermanentInterviewAiError(
          'invalid_scenario',
          'Generated interview scenario has no questions',
        );
      }
      await this.repository.completeScenarioGeneration({ context, sessionId, scenario });
    } catch (error) {
      if (!(error instanceof PermanentInterviewAiError)) throw error;
      await this.repository.failScenarioGeneration({
        context,
        sessionId,
        failureCode: error.code,
      });
    }
  }

  async generateReport(context: MessageContext, sessionId: string): Promise<void> {
    if (await this.repository.isMessageProcessed(context.messageId)) return;

    const session = await this.repository.findSession(sessionId);
    if (!session) throw new Error(`Interview session ${sessionId} was not found`);
    if (session.status !== 'completed' || session.reportStatus !== 'pending') {
      await this.repository.acknowledgeMessage(context.messageId);
      return;
    }

    try {
      const report = await this.ai.generateReport(session);
      await this.repository.completeReportGeneration({ context, sessionId, report });
    } catch (error) {
      if (!(error instanceof PermanentInterviewAiError)) throw error;
      await this.repository.failReportGeneration({
        context,
        sessionId,
        failureCode: error.code,
      });
    }
  }
}
