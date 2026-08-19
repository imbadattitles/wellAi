import { Kafka, Producer } from 'kafkajs';
import { MessageEnvelope } from '@wellllai/contracts';

export interface EventPublisher {
  publish(topic: string, key: string, message: MessageEnvelope): Promise<void>;
}

export class KafkaEventPublisher implements EventPublisher {
  private readonly producer: Producer;
  private connected = false;

  constructor(clientId: string, brokers: string[]) {
    this.producer = new Kafka({ clientId, brokers }).producer();
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    await this.producer.connect();
    this.connected = true;
  }

  async publish(topic: string, key: string, message: MessageEnvelope): Promise<void> {
    await this.connect();
    await this.producer.send({
      topic,
      messages: [{ key, value: JSON.stringify(message) }],
    });
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    await this.producer.disconnect();
    this.connected = false;
  }
}
