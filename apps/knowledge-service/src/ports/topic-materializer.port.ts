export interface MaterializedTopicSection {
  title: string;
  summary: string;
  content: string;
}

export interface MaterializedTopic {
  title: string;
  summary: string;
  sections: MaterializedTopicSection[];
}

export interface MaterializeTopicInput {
  topic: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  goal: string;
  language: string;
}

export interface TopicMaterializerPort {
  readonly model: string;
  materialize(input: MaterializeTopicInput): Promise<MaterializedTopic>;
}

export const TOPIC_MATERIALIZER = Symbol('TOPIC_MATERIALIZER');
