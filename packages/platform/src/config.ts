import { z } from 'zod';

const commonEnvironmentSchema = z.object({
  DATABASE_URL: z.string().url(),
  KAFKA_BROKERS: z.string().min(1),
  REDIS_URL: z.string().url(),
});

export type CommonEnvironment = z.infer<typeof commonEnvironmentSchema> & {
  kafkaBrokers: string[];
};

export function readCommonEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): CommonEnvironment {
  const parsed = commonEnvironmentSchema.parse(environment);
  return {
    ...parsed,
    kafkaBrokers: readKafkaBrokers(parsed),
  };
}

export function readPort(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`${name} must be a valid TCP port`);
  }
  return port;
}

export function readKafkaBrokers(
  environment: { KAFKA_BROKERS?: string } = process.env,
  fallback = 'localhost:9092',
): string[] {
  const brokers = (environment.KAFKA_BROKERS ?? fallback)
    .split(',')
    .map((broker) => broker.trim())
    .filter(Boolean);
  if (brokers.length === 0) throw new Error('KAFKA_BROKERS must contain at least one broker');
  return brokers;
}
