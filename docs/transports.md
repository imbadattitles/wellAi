# Transport boundaries

Проект использует разные транспорты для разных семантик, а не один транспорт для всех вызовов.

| Граница                              | Транспорт  | Причина                                        |
| ------------------------------------ | ---------- | ---------------------------------------------- |
| Browser → API Gateway                | REST/HTTP  | публичный request/response API                 |
| API Gateway → domain services        | HTTP       | простая маршрутизация и multipart-загрузка PDF |
| Learning → Knowledge retrieval       | unary gRPC | быстрый типизированный внутренний запрос       |
| Domain services → domain services    | Kafka      | долгие команды и доменные события              |
| API Gateway → Browser status updates | SSE        | односторонние realtime-обновления              |

## gRPC retrieval

Контракт находится в `packages/contracts/proto/knowledge.proto`. Knowledge-service слушает
`KNOWLEDGE_GRPC_BIND_URL`, а learning-service подключается по `KNOWLEDGE_GRPC_URL`. Вызов имеет
15-секундный deadline; ответ повторно проверяется общей Zod-схемой перед передачей в AI-слой.
PDF продолжает загружаться по HTTP и через gRPC не передаётся.

## SSE statuses

Публичные потоки:

```text
GET /api/v1/learning-programs/:programId/events
GET /api/v1/interview-programs/:sessionId/events
```

Цепочка доставки:

```text
service transaction → outbox → Kafka → API Gateway → Redis Pub/Sub → SSE → browser
```

Redis раздаёт status hint всем репликам gateway. После hint gateway читает каноническое состояние
у доменного сервиса и отправляет snapshot клиенту. При подключении snapshot отправляется сразу,
поэтому reconnect восстанавливает состояние без replay из Redis. Heartbeat отправляется каждые
15 секунд.

Frontend использует fetch-based SSE, потому что текущая demo-идентификация передаёт `x-user-id`,
а нативный `EventSource` не позволяет задавать произвольные заголовки. Клиент переподключается с
backoff; при ошибке временно включается reconciliation polling раз в 7,5 секунды.
