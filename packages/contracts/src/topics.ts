export const KafkaTopics = {
  knowledgeCommands: 'knowledge.commands.v1',
  knowledgeEvents: 'knowledge.events.v1',
  learningCommands: 'learning.commands.v1',
  learningEvents: 'learning.events.v1',
  interviewCommands: 'interview.commands.v1',
  interviewEvents: 'interview.events.v1',
} as const;

export const MessageTypes = {
  knowledgeDocumentIngestionRequested: 'knowledge.document.ingestion.requested',
  knowledgeTopicMaterializationRequested: 'knowledge.topic.materialization.requested',
  knowledgeSourceReady: 'knowledge.source.ready',
  knowledgeSourceFailed: 'knowledge.source.failed',
  learningQuizGenerationRequested: 'learning.quiz.generation.requested',
  learningLessonGenerationRequested: 'learning.lesson.generation.requested',
  learningQuizReady: 'learning.quiz.ready',
  learningAttemptGraded: 'learning.attempt.graded',
  learningMasteryUpdated: 'learning.mastery.updated',
  learningProgramStatusChanged: 'learning.program.status.changed',
  interviewScenarioGenerationRequested: 'interview.scenario.generation.requested',
  interviewScenarioReady: 'interview.scenario.ready',
  interviewScenarioGenerationFailed: 'interview.scenario.generation.failed',
  interviewReportGenerationRequested: 'interview.report.generation.requested',
  interviewSessionCompleted: 'interview.session.completed',
  interviewReportReady: 'interview.report.ready',
  interviewReportGenerationFailed: 'interview.report.generation.failed',
} as const;

export type KafkaTopic = (typeof KafkaTopics)[keyof typeof KafkaTopics];
export type MessageType = (typeof MessageTypes)[keyof typeof MessageTypes];
