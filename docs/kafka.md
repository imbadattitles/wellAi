# Kafka contracts

Все сообщения используют общий envelope:

```ts
interface MessageEnvelope<T> {
  messageId: string;
  messageType: string;
  schemaVersion: 1;
  occurredAt: string;
  producer: string;
  aggregateId: string;
  correlationId: string;
  causationId: string | null;
  traceparent: string | null;
  payload: T;
}
```

## Topics

```text
knowledge.commands.v1
knowledge.events.v1
learning.commands.v1
learning.events.v1
interview.commands.v1
interview.events.v1
```

Версия topic отражает несовместимую транспортную версию. Совместимые добавления оформляются новой версией `messageType`-схемы без переименования topic.

## Основные команды

В текущем MVP реально обрабатываются команды knowledge и interview. Команды learning ниже
зарезервированы для асинхронных карточек и следующего урока; синхронные Q&A и тесты пока идут
через HTTP.

```text
knowledge.document.ingestion.requested
knowledge.topic.materialization.requested
learning.quiz.generation.requested
learning.lesson.generation.requested
interview.scenario.generation.requested
interview.report.generation.requested
```

## Основные события

Knowledge- и interview-события входят в текущий поток. Learning-service также публикует
`learning.program.status.changed` после фиксации терминального статуса программы; gateway
использует это событие для SSE. Остальные learning-события зарезервированы для будущей
асинхронной аналитики; попытки и mastery в MVP записываются транзакционно самим learning-service.

```text
knowledge.source.ready
knowledge.source.failed
learning.quiz.ready
learning.attempt.graded
learning.mastery.updated
learning.program.status.changed
interview.scenario.ready
interview.scenario.generation.failed
interview.session.completed
interview.report.ready
interview.report.generation.failed
```

Сообщения содержат идентификаторы и стабильные метаданные. PDF, chunks и длинные ответы пользователя через Kafka не передаются.

## Доставка

Проект рассчитывает на `at-least-once` доставку:

1. Доменное изменение и outbox-запись создаются в одной PostgreSQL-транзакции.
2. Relay читает записи через `FOR UPDATE SKIP LOCKED` и публикует их.
3. Consumer записывает `messageId` в inbox в той же транзакции, что и своё изменение.
4. Повторная доставка того же `messageId` не меняет состояние повторно.

После исчерпания retry сообщение должно попадать в соответствующий DLQ. Конкретная retry/DLQ-конфигурация относится к будущей инфраструктурной итерации.
