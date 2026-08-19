'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { ErrorNotice } from '../../../components/CreationFeedback';
import {
  AlertIcon,
  ArrowIcon,
  CheckIcon,
  InterviewIcon,
  SparkIcon,
} from '../../../components/Icons';
import {
  createRequestId,
  getErrorMessage,
  getInterview,
  submitInterviewAnswer,
  type InterviewAnswerResult,
  type InterviewSession,
} from '../../../lib/api-client';

interface PendingSubmission {
  answerId: string;
  expectedQuestionIndex: number;
  answer: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const levelLabels: Record<InterviewSession['level'], string> = {
  junior: 'Junior',
  middle: 'Middle',
  senior: 'Senior',
  lead: 'Lead',
};

const formatLabels: Record<InterviewSession['format'], string> = {
  technical: 'Техническое',
  behavioral: 'Поведенческое',
  mixed: 'Смешанное',
};

function toPercent(value: number): number {
  return Math.round(Math.min(1, Math.max(0, value)) * 100);
}

function FeedbackPanel({ result }: { result: InterviewAnswerResult }) {
  return (
    <section className="interview-feedback" aria-live="polite" aria-labelledby="feedback-title">
      <div className="feedback-score" aria-label={`Оценка ${toPercent(result.score)} процентов`}>
        {toPercent(result.score)}%
      </div>
      <div className="feedback-content">
        <p className="eyebrow">Разбор ответа</p>
        <h2 id="feedback-title">{result.feedback}</h2>
        <div className="feedback-columns">
          <div>
            <h3>Сильные стороны</h3>
            {result.strengths.length ? (
              <ul className="report-list report-list-positive">
                {result.strengths.map((strength) => (
                  <li key={strength}>{strength}</li>
                ))}
              </ul>
            ) : (
              <p>Отдельные сильные стороны не отмечены.</p>
            )}
          </div>
          <div>
            <h3>Что улучшить</h3>
            {result.gaps.length ? (
              <ul className="report-list">
                {result.gaps.map((gap) => (
                  <li key={gap}>{gap}</li>
                ))}
              </ul>
            ) : (
              <p>Дополнительные пробелы не отмечены.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function InterviewSessionPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<InterviewAnswerResult | null>(null);
  const [pendingSubmission, setPendingSubmission] = useState<PendingSubmission | null>(null);

  const loadSession = useCallback(
    async (silent = false) => {
      if (!UUID_PATTERN.test(sessionId)) {
        setPageError('Некорректный идентификатор интервью.');
        setIsLoading(false);
        return;
      }

      if (!silent) setIsLoading(true);
      try {
        const nextSession = await getInterview(sessionId);
        setSession(nextSession);
        setPageError(null);
        setPollError(null);
      } catch (error) {
        const message = getErrorMessage(error);
        if (silent) setPollError(message);
        else setPageError(message);
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [sessionId],
  );

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const shouldPoll =
    session?.status === 'scenario_pending' ||
    (session?.status === 'completed' &&
      session.reportStatus !== 'ready' &&
      session.reportStatus !== 'failed');

  useEffect(() => {
    if (!shouldPoll) return;
    const timer = window.setInterval(() => void loadSession(true), 2500);
    return () => window.clearInterval(timer);
  }, [loadSession, shouldPoll]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedAnswer = answer.trim();
    const questionIndex = session?.currentQuestionIndex;
    if (!normalizedAnswer || questionIndex === null || questionIndex === undefined) return;

    const submission =
      pendingSubmission?.expectedQuestionIndex === questionIndex &&
      pendingSubmission.answer === normalizedAnswer
        ? pendingSubmission
        : {
            answerId: createRequestId(),
            expectedQuestionIndex: questionIndex,
            answer: normalizedAnswer,
          };

    setAnswerError(null);
    setPendingSubmission(submission);
    setIsSubmitting(true);
    try {
      const result = await submitInterviewAnswer(sessionId, submission);
      setLastResult(result);
      setPendingSubmission(null);
      setAnswer('');
      await loadSession(true);
    } catch (error) {
      setAnswerError(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <main id="main-content" className="workspace-page" aria-busy="true">
        <div className="skeleton workspace-heading-skeleton" />
        <div className="workspace-layout">
          <div className="skeleton workspace-content-skeleton" />
          <div className="skeleton workspace-sidebar-skeleton" />
        </div>
        <span className="visually-hidden">Загружаем интервью…</span>
      </main>
    );
  }

  if (pageError || !session) {
    return (
      <main id="main-content" className="centered-state">
        <span className="state-illustration state-illustration-error" aria-hidden="true">
          <AlertIcon width={34} height={34} />
        </span>
        <p className="eyebrow">Сессия недоступна</p>
        <h1>Не удалось открыть интервью</h1>
        <p>{pageError ?? 'Сервер не вернул данные сессии.'}</p>
        <div className="state-actions">
          <button className="button button-dark" type="button" onClick={() => void loadSession()}>
            Попробовать снова
          </button>
          <Link className="button button-secondary" href="/">
            На главную
          </Link>
        </div>
      </main>
    );
  }

  if (session.status === 'scenario_pending') {
    return (
      <main id="main-content" className="workspace-page">
        <Link className="breadcrumb" href="/">
          ← Главная
        </Link>
        <section
          className="waiting-panel waiting-panel-interview"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="waiting-visual" aria-hidden="true">
            <span className="waiting-ring" />
            <span className="waiting-center">
              <InterviewIcon />
            </span>
          </div>
          <p className="eyebrow">
            {levelLabels[session.level]} · {session.profession}
          </p>
          <h1>Готовим сценарий интервью</h1>
          <p>
            Сессия ещё не началась. Страница проверяет статус и покажет первый вопрос, когда
            сценарий будет готов.
          </p>
          <div className="polling-status">
            <span className="spinner spinner-dark" aria-hidden="true" />
            Ожидаем сценарий
          </div>
          {pollError ? <p className="inline-error">{pollError}</p> : null}
        </section>
      </main>
    );
  }

  if (session.status === 'failed') {
    return (
      <main id="main-content" className="centered-state">
        <span className="state-illustration state-illustration-error" aria-hidden="true">
          <AlertIcon width={34} height={34} />
        </span>
        <p className="eyebrow">Подготовка остановлена</p>
        <h1>Сценарий не удалось создать</h1>
        <p>Попробуйте начать новую сессию. Код ошибки: {session.failureCode ?? 'не указан'}.</p>
        <div className="state-actions">
          <Link className="button button-dark" href="/interview/new">
            Новое интервью
          </Link>
          <Link className="button button-secondary" href="/">
            На главную
          </Link>
        </div>
      </main>
    );
  }

  if (session.status === 'completed') {
    const report = session.report;

    return (
      <main id="main-content" className="workspace-page report-page">
        <Link className="breadcrumb" href="/">
          ← Главная
        </Link>
        <header className="workspace-heading report-heading">
          <div>
            <div className="workspace-kicker-row">
              <span className="status-pill status-ready">
                <CheckIcon width={14} height={14} /> Интервью завершено
              </span>
              <span>{session.profession}</span>
            </div>
            <h1>{report ? 'Ваш разбор готов' : 'Ответы приняты'}</h1>
            <p>
              {report
                ? report.summary
                : 'Сессия завершена. Итоговый отчёт ещё формируется на сервере.'}
            </p>
          </div>
          <Link className="button button-secondary" href="/interview/new">
            Новое интервью
          </Link>
        </header>

        {lastResult ? (
          <div className="final-feedback-wrap">
            <FeedbackPanel result={lastResult} />
          </div>
        ) : null}

        {report && session.reportStatus === 'ready' ? (
          <div className="report-layout">
            <section className="report-score-card" aria-label="Итоговая оценка">
              <p className="eyebrow">Общий результат</p>
              <strong>{toPercent(report.overallScore)}%</strong>
              <div
                className="report-score-track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={toPercent(report.overallScore)}
              >
                <span style={{ width: `${toPercent(report.overallScore)}%` }} />
              </div>
              <small>Оценка сформирована по ответам этой сессии.</small>
            </section>

            <section
              className="report-card report-competencies"
              aria-labelledby="competencies-title"
            >
              <p className="eyebrow">По компетенциям</p>
              <h2 id="competencies-title">Детали результата</h2>
              {report.competencyScores.length ? (
                <div className="competency-list">
                  {report.competencyScores.map((competency) => (
                    <article key={competency.competency}>
                      <div>
                        <h3>{competency.competency}</h3>
                        <strong>{toPercent(competency.score)}%</strong>
                      </div>
                      <p>{competency.evidence}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="empty-copy-small">Отдельные оценки компетенций не вернулись.</p>
              )}
            </section>

            <section className="report-card" aria-labelledby="strengths-title">
              <p className="eyebrow">Опора</p>
              <h2 id="strengths-title">Сильные стороны</h2>
              {report.strengths.length ? (
                <ul className="report-list report-list-positive">
                  {report.strengths.map((strength) => (
                    <li key={strength}>{strength}</li>
                  ))}
                </ul>
              ) : (
                <p className="empty-copy-small">Сильные стороны отдельно не перечислены.</p>
              )}
            </section>

            <section className="report-card" aria-labelledby="gaps-title">
              <p className="eyebrow">Зоны роста</p>
              <h2 id="gaps-title">Что улучшить</h2>
              {report.gaps.length ? (
                <ul className="report-list">
                  {report.gaps.map((gap) => (
                    <li key={gap}>{gap}</li>
                  ))}
                </ul>
              ) : (
                <p className="empty-copy-small">Отдельные пробелы не перечислены.</p>
              )}
            </section>

            <section
              className="report-card report-recommendations"
              aria-labelledby="recommendations-title"
            >
              <span className="workspace-card-icon">
                <SparkIcon width={21} height={21} />
              </span>
              <div>
                <p className="eyebrow">Следующий шаг</p>
                <h2 id="recommendations-title">Рекомендации</h2>
                {report.recommendations.length ? (
                  <ol>
                    {report.recommendations.map((recommendation) => (
                      <li key={recommendation}>{recommendation}</li>
                    ))}
                  </ol>
                ) : (
                  <p className="empty-copy-small">Рекомендации не вернулись.</p>
                )}
              </div>
            </section>
          </div>
        ) : session.reportStatus === 'failed' || session.reportStatus === 'ready' ? (
          <section className="report-pending-card" role="status">
            <AlertIcon width={24} height={24} />
            <div>
              <h2>Отчёт не сформирован</h2>
              <p>Ответы сохранены, но сервер не вернул данные итогового отчёта.</p>
            </div>
          </section>
        ) : (
          <section className="report-pending-card" role="status" aria-live="polite">
            <span className="spinner spinner-dark" aria-hidden="true" />
            <div>
              <h2>Формируем итоговый отчёт</h2>
              <p>Страница обновится автоматически после ответа сервера.</p>
              {pollError ? <span className="inline-error">{pollError}</span> : null}
            </div>
          </section>
        )}
      </main>
    );
  }

  return (
    <main id="main-content" className="workspace-page interview-session-page">
      <Link className="breadcrumb" href="/">
        ← Главная
      </Link>

      <header className="workspace-heading interview-session-heading">
        <div>
          <div className="workspace-kicker-row">
            <span className="status-pill status-live">
              <span aria-hidden="true" /> Интервью идёт
            </span>
            <span>
              {formatLabels[session.format]} · {levelLabels[session.level]}
            </span>
          </div>
          <h1>{session.profession}</h1>
          <p>
            {session.technologies.length
              ? session.technologies.join(' · ')
              : 'Без списка технологий'}
          </p>
        </div>
        <div className="interview-counter" aria-label="Прогресс интервью">
          <strong>{(session.currentQuestionIndex ?? session.answeredQuestions) + 1}</strong>
          <span>из {session.totalQuestions || '—'}</span>
        </div>
      </header>

      <div className="interview-session-layout">
        <div className="interview-stage">
          {session.openingMessage && session.answeredQuestions === 0 ? (
            <div className="interviewer-message">
              <span className="interviewer-avatar" aria-hidden="true">
                AI
              </span>
              <p>{session.openingMessage}</p>
            </div>
          ) : null}

          {lastResult ? <FeedbackPanel result={lastResult} /> : null}

          <section className="current-question" aria-labelledby="current-question-title">
            <div className="question-meta">
              <span>Вопрос {(session.currentQuestionIndex ?? session.answeredQuestions) + 1}</span>
              <span>Можно отвечать в своём темпе</span>
            </div>
            <h2 id="current-question-title">
              {session.currentQuestion ?? 'Вопрос пока недоступен. Обновите состояние сессии.'}
            </h2>

            {answerError ? <ErrorNotice message={answerError} /> : null}
            {pollError ? <p className="inline-error">{pollError}</p> : null}

            <form className="interview-answer-form" onSubmit={handleSubmit}>
              <label htmlFor="interview-answer">Ваш ответ</label>
              <textarea
                id="interview-answer"
                rows={8}
                maxLength={10000}
                placeholder="Сформулируйте ответ так, как сказали бы его на настоящем интервью"
                value={answer}
                onChange={(event) => {
                  setAnswer(event.target.value);
                  if (pendingSubmission && event.target.value.trim() !== pendingSubmission.answer) {
                    setPendingSubmission(null);
                  }
                }}
                disabled={
                  isSubmitting || !session.currentQuestion || session.currentQuestionIndex === null
                }
                required
              />
              <div className="answer-form-footer">
                <span>{answer.length}/10000</span>
                <button
                  className="button button-dark"
                  type="submit"
                  disabled={
                    isSubmitting ||
                    !answer.trim() ||
                    !session.currentQuestion ||
                    session.currentQuestionIndex === null
                  }
                >
                  {isSubmitting ? (
                    <>
                      <span className="spinner" aria-hidden="true" /> Проверяем ответ…
                    </>
                  ) : (
                    <>
                      {pendingSubmission?.answer === answer.trim() &&
                      pendingSubmission.expectedQuestionIndex === session.currentQuestionIndex
                        ? 'Повторить отправку'
                        : 'Отправить ответ'}
                      <ArrowIcon width={18} height={18} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
        </div>

        <aside className="interview-history" aria-labelledby="history-title">
          <div className="history-heading">
            <span className="workspace-card-icon workspace-card-icon-violet">
              <InterviewIcon width={20} height={20} />
            </span>
            <div>
              <p className="eyebrow">Сессия</p>
              <h2 id="history-title">Предыдущие ответы</h2>
            </div>
          </div>

          {session.turns.length ? (
            <ol className="turn-list">
              {[...session.turns].reverse().map((turn) => (
                <li key={turn.id}>
                  <div>
                    <span>Вопрос {turn.questionIndex + 1}</span>
                    <strong>{toPercent(turn.score)}%</strong>
                  </div>
                  <p>{turn.question}</p>
                  <details>
                    <summary>Посмотреть ответ и разбор</summary>
                    <blockquote>{turn.answer}</blockquote>
                    <small>{turn.feedback}</small>
                  </details>
                </li>
              ))}
            </ol>
          ) : (
            <div className="history-empty">
              <SparkIcon width={22} height={22} />
              <p>Здесь появятся отправленные ответы и их оценки.</p>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
