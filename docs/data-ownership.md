# Владение данными

## `knowledge` schema

- источники знаний;
- PDF blobs для ограниченного MVP;
- неизменяемые версии знаний;
- chunks и embeddings;
- темы и связи с chunks;
- собственные outbox/inbox.

Только knowledge-service выполняет vector search.

## `learning` schema

- учебные программы;
- вопросы и ответы с citation snapshots;
- тесты и вопросы;
- попытки;
- mastery по темам;
- собственные outbox/inbox.

Learning-service получает контекст только через internal API knowledge-service.

## `interview` schema

- профиль подготовки;
- сценарии и критерии;
- сессии и ходы;
- оценки компетенций;
- итоговые отчёты;
- собственные outbox/inbox.

## Запреты

- один сервис не выполняет запросы к таблицам другого;
- транспортные DTO не являются database entities;
- миграции принадлежат сервисам;
- изменение модели embeddings создаёт новую knowledge version и переиндексацию.
