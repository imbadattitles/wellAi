'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { ErrorNotice } from '../../../components/CreationFeedback';
import {
  AlertIcon,
  ArrowIcon,
  BookIcon,
  CheckIcon,
  DocumentIcon,
  SparkIcon,
} from '../../../components/Icons';
import {
  askLearningQuestion,
  generateLearningQuiz,
  getErrorMessage,
  getLearningProgram,
  getProgramProgress,
  submitLearningAnswer,
  type AnswerEvaluation,
  type CitedAnswer,
  type LearningProgram,
  type ProgramProgress,
  type Quiz,
  type QuizQuestion,
} from '../../../lib/api-client';
import { subscribeToLearningProgramStates } from '../../../lib/status-stream';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toPercent(value: number): number {
  return Math.round(Math.min(1, Math.max(0, value)) * 100);
}

function sourceLabel(program: LearningProgram): string {
  return program.sourceType === 'document' ? 'Программа по PDF' : 'Программа по теме';
}

interface QuizQuestionCardProps {
  question: QuizQuestion;
  index: number;
  answer: string;
  evaluation?: AnswerEvaluation | undefined;
  isSubmitting: boolean;
  onAnswerChange: (answer: string) => void;
  onSubmit: () => void;
}

function QuizQuestionCard({
  question,
  index,
  answer,
  evaluation,
  isSubmitting,
  onAnswerChange,
  onSubmit,
}: QuizQuestionCardProps) {
  const fieldName = `question-${question.id}`;

  return (
    <article className="quiz-question-card">
      <div className="quiz-question-heading">
        <span className="question-index">{String(index + 1).padStart(2, '0')}</span>
        <div>
          <span className="question-topic">{question.topic}</span>
          <h3>{question.prompt}</h3>
        </div>
      </div>

      {question.type === 'single_choice' && question.options ? (
        <fieldset className="option-list" disabled={isSubmitting || Boolean(evaluation)}>
          <legend className="visually-hidden">Выберите один ответ</legend>
          {question.options.map((option) => (
            <label className="quiz-option" key={option}>
              <input
                type="radio"
                name={fieldName}
                value={option}
                checked={answer === option}
                onChange={(event) => onAnswerChange(event.target.value)}
              />
              <span>{option}</span>
            </label>
          ))}
        </fieldset>
      ) : (
        <div className="field-group quiz-free-answer">
          <label htmlFor={fieldName}>Ваш ответ</label>
          <textarea
            id={fieldName}
            rows={4}
            maxLength={10000}
            placeholder="Объясните своими словами"
            value={answer}
            onChange={(event) => onAnswerChange(event.target.value)}
            disabled={isSubmitting || Boolean(evaluation)}
          />
        </div>
      )}

      {!evaluation ? (
        <button
          className="button button-secondary quiz-submit"
          type="button"
          onClick={onSubmit}
          disabled={!answer.trim() || isSubmitting}
        >
          {isSubmitting ? (
            <>
              <span className="spinner spinner-dark" aria-hidden="true" /> Проверяем…
            </>
          ) : (
            'Проверить ответ'
          )}
        </button>
      ) : (
        <div className="evaluation-card" aria-live="polite">
          <span className="evaluation-score">{toPercent(evaluation.score)}%</span>
          <div>
            <strong>{evaluation.feedback}</strong>
            {evaluation.missingPoints.length ? (
              <ul>
                {evaluation.missingPoints.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            ) : (
              <p>Дополнительных пропусков в ответе не отмечено.</p>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

export default function LearningProgramPage() {
  const params = useParams<{ programId: string }>();
  const programId = params.programId;
  const [program, setProgram] = useState<LearningProgram | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [citedAnswer, setCitedAnswer] = useState<CitedAnswer | null>(null);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [evaluations, setEvaluations] = useState<Record<string, AnswerEvaluation>>({});
  const [submittingQuestions, setSubmittingQuestions] = useState<Record<string, boolean>>({});
  const [progress, setProgress] = useState<ProgramProgress | null>(null);
  const [progressError, setProgressError] = useState<string | null>(null);

  const loadProgram = useCallback(
    async (silent = false) => {
      if (!UUID_PATTERN.test(programId)) {
        setPageError('Некорректный идентификатор программы.');
        setIsLoading(false);
        return;
      }

      if (!silent) setIsLoading(true);
      try {
        const nextProgram = await getLearningProgram(programId);
        setProgram(nextProgram);
        setPageError(null);
        setStreamError(null);
      } catch (error) {
        const message = getErrorMessage(error);
        if (silent) setStreamError(message);
        else setPageError(message);
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [programId],
  );

  const loadProgress = useCallback(async () => {
    try {
      const nextProgress = await getProgramProgress(programId);
      setProgress(nextProgress);
      setProgressError(null);
    } catch (error) {
      setProgressError(getErrorMessage(error));
    }
  }, [programId]);

  useEffect(() => {
    void loadProgram();
  }, [loadProgram]);

  const isProcessing = program?.status === 'pending' || program?.status === 'processing';

  useEffect(() => {
    if (!isProcessing) return;
    let fallbackTimer: number | null = null;
    const stopFallback = () => {
      if (fallbackTimer !== null) window.clearInterval(fallbackTimer);
      fallbackTimer = null;
    };
    const startFallback = () => {
      if (fallbackTimer === null) {
        void loadProgram(true);
        fallbackTimer = window.setInterval(() => void loadProgram(true), 7_500);
      }
    };

    const unsubscribe = subscribeToLearningProgramStates<LearningProgram>(programId, {
      onOpen: () => {
        stopFallback();
        setStreamError(null);
      },
      onState: (nextProgram) => {
        setProgram(nextProgram);
        setStreamError(null);
        return nextProgram.status === 'pending' || nextProgram.status === 'processing';
      },
      onError: (error) => {
        setStreamError(`${getErrorMessage(error)} Повторяем подключение…`);
        startFallback();
      },
    });
    const reconcileWhenVisible = () => {
      if (document.visibilityState === 'visible') void loadProgram(true);
    };
    document.addEventListener('visibilitychange', reconcileWhenVisible);

    return () => {
      document.removeEventListener('visibilitychange', reconcileWhenVisible);
      unsubscribe();
      stopFallback();
    };
  }, [isProcessing, loadProgram]);

  useEffect(() => {
    if (program?.status === 'ready') void loadProgress();
  }, [program?.status, loadProgress]);

  async function handleAsk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedQuestion = question.trim();
    if (!normalizedQuestion) return;

    setQuestionError(null);
    setCitedAnswer(null);
    setIsAsking(true);
    try {
      setCitedAnswer(await askLearningQuestion(programId, normalizedQuestion));
    } catch (error) {
      setQuestionError(getErrorMessage(error));
    } finally {
      setIsAsking(false);
    }
  }

  async function handleGenerateQuiz() {
    setQuizError(null);
    setIsGeneratingQuiz(true);
    try {
      const nextQuiz = await generateLearningQuiz(programId);
      setQuiz(nextQuiz);
      setQuizAnswers({});
      setEvaluations({});
    } catch (error) {
      setQuizError(getErrorMessage(error));
    } finally {
      setIsGeneratingQuiz(false);
    }
  }

  async function handleSubmitQuizAnswer(questionId: string) {
    const answer = quizAnswers[questionId]?.trim();
    if (!answer) return;

    setQuizError(null);
    setSubmittingQuestions((current) => ({ ...current, [questionId]: true }));
    try {
      const evaluation = await submitLearningAnswer(questionId, answer);
      setEvaluations((current) => ({ ...current, [questionId]: evaluation }));
      await loadProgress();
    } catch (error) {
      setQuizError(getErrorMessage(error));
    } finally {
      setSubmittingQuestions((current) => ({ ...current, [questionId]: false }));
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
        <span className="visually-hidden">Загружаем программу…</span>
      </main>
    );
  }

  if (pageError || !program) {
    return (
      <main id="main-content" className="centered-state">
        <span className="state-illustration state-illustration-error" aria-hidden="true">
          <AlertIcon width={34} height={34} />
        </span>
        <p className="eyebrow">Программа недоступна</p>
        <h1>Не удалось открыть обучение</h1>
        <p>{pageError ?? 'Сервер не вернул данные программы.'}</p>
        <div className="state-actions">
          <button className="button button-dark" type="button" onClick={() => void loadProgram()}>
            Попробовать снова
          </button>
          <Link className="button button-secondary" href="/">
            На главную
          </Link>
        </div>
      </main>
    );
  }

  if (isProcessing) {
    return (
      <main id="main-content" className="workspace-page">
        <Link className="breadcrumb" href="/">
          ← Главная
        </Link>
        <section className="waiting-panel" aria-live="polite" aria-busy="true">
          <div className="waiting-visual" aria-hidden="true">
            <span className="waiting-ring" />
            <span className="waiting-center">
              {program.sourceType === 'document' ? <DocumentIcon /> : <BookIcon />}
            </span>
          </div>
          <p className="eyebrow">{sourceLabel(program)}</p>
          <h1>{program.title}</h1>
          <p>
            Сервер обрабатывает материал и готовит структуру программы. Страница обновится
            автоматически, когда программа будет готова.
          </p>
          <div className="live-status">
            <span className="spinner spinner-dark" aria-hidden="true" />
            Статус: {program.status === 'pending' ? 'в очереди' : 'обработка'}
          </div>
          {streamError ? <p className="inline-error">{streamError}</p> : null}
        </section>
      </main>
    );
  }

  if (program.status === 'failed') {
    return (
      <main id="main-content" className="centered-state">
        <span className="state-illustration state-illustration-error" aria-hidden="true">
          <AlertIcon width={34} height={34} />
        </span>
        <p className="eyebrow">Обработка остановлена</p>
        <h1>Программу не удалось подготовить</h1>
        <p>Попробуйте создать её ещё раз. Код ошибки: {program.failureCode ?? 'не указан'}.</p>
        <div className="state-actions">
          <Link className="button button-dark" href="/learn/new">
            Создать заново
          </Link>
          <Link className="button button-secondary" href="/">
            На главную
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main id="main-content" className="workspace-page">
      <Link className="breadcrumb" href="/">
        ← Главная
      </Link>

      <header className="workspace-heading">
        <div>
          <div className="workspace-kicker-row">
            <span className="status-pill status-ready">
              <CheckIcon width={14} height={14} /> Готово
            </span>
            <span>{sourceLabel(program)}</span>
          </div>
          <h1>{program.title}</h1>
          {program.goal ? <p>{program.goal}</p> : null}
        </div>
        <Link className="button button-secondary" href="/learn/new">
          Новая программа
        </Link>
      </header>

      <div className="workspace-layout">
        <div className="workspace-main">
          <section className="workspace-card" aria-labelledby="question-title">
            <div className="workspace-card-heading">
              <span className="workspace-card-icon">
                <SparkIcon width={21} height={21} />
              </span>
              <div>
                <p className="eyebrow">Вопрос по материалу</p>
                <h2 id="question-title">Разберите непонятное место</h2>
              </div>
            </div>
            <p className="workspace-card-copy">
              Ответ будет основан на подготовленном материале. Доступные цитаты появятся под
              ответом.
            </p>

            {questionError ? <ErrorNotice message={questionError} /> : null}

            <form className="question-form" onSubmit={handleAsk}>
              <label className="visually-hidden" htmlFor="learning-question">
                Ваш вопрос
              </label>
              <textarea
                id="learning-question"
                rows={3}
                minLength={2}
                maxLength={2000}
                placeholder="Например: чем MVCC отличается от обычной блокировки строк?"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                disabled={isAsking}
                required
              />
              <button
                className="button button-dark"
                type="submit"
                disabled={isAsking || !question.trim()}
              >
                {isAsking ? (
                  <>
                    <span className="spinner" aria-hidden="true" /> Ищем в материале…
                  </>
                ) : (
                  <>
                    Получить ответ <ArrowIcon width={18} height={18} />
                  </>
                )}
              </button>
            </form>

            {citedAnswer ? (
              <article className="cited-answer" aria-live="polite">
                <div className="cited-answer-heading">
                  <span className="answer-mark" aria-hidden="true">
                    AI
                  </span>
                  <strong>Ответ</strong>
                </div>
                <p>{citedAnswer.answer}</p>
                {citedAnswer.insufficientContext ? (
                  <div className="context-warning">
                    В подготовленном материале недостаточно сведений для уверенного ответа.
                  </div>
                ) : null}
                {citedAnswer.citations.length ? (
                  <div className="citation-block">
                    <h3>Фрагменты-источники</h3>
                    <ol className="citation-list">
                      {citedAnswer.citations.map((citation) => (
                        <li key={`${citation.chunkId}-${citation.quote}`}>
                          <blockquote>«{citation.quote}»</blockquote>
                          <span>Фрагмент {citation.chunkId.slice(0, 8)}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}
              </article>
            ) : null}
          </section>

          <section className="workspace-card" aria-labelledby="quiz-title">
            <div className="quiz-heading">
              <div className="workspace-card-heading">
                <span className="workspace-card-icon workspace-card-icon-violet">
                  <BookIcon width={21} height={21} />
                </span>
                <div>
                  <p className="eyebrow">Проверка знаний</p>
                  <h2 id="quiz-title">Тест из пяти вопросов</h2>
                </div>
              </div>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => void handleGenerateQuiz()}
                disabled={isGeneratingQuiz}
              >
                {isGeneratingQuiz ? (
                  <>
                    <span className="spinner spinner-dark" aria-hidden="true" /> Создаём…
                  </>
                ) : quiz ? (
                  'Новый тест'
                ) : (
                  'Создать тест'
                )}
              </button>
            </div>

            {quizError ? <ErrorNotice message={quizError} /> : null}

            {!quiz && !isGeneratingQuiz ? (
              <div className="quiz-empty">
                <span aria-hidden="true">5</span>
                <p>Создайте тест, когда будете готовы проверить понимание материала.</p>
              </div>
            ) : null}

            {quiz ? (
              <div className="quiz-list">
                {quiz.questions.map((quizQuestion, index) => (
                  <QuizQuestionCard
                    key={quizQuestion.id}
                    question={quizQuestion}
                    index={index}
                    answer={quizAnswers[quizQuestion.id] ?? ''}
                    evaluation={evaluations[quizQuestion.id]}
                    isSubmitting={Boolean(submittingQuestions[quizQuestion.id])}
                    onAnswerChange={(answer) =>
                      setQuizAnswers((current) => ({
                        ...current,
                        [quizQuestion.id]: answer,
                      }))
                    }
                    onSubmit={() => void handleSubmitQuizAnswer(quizQuestion.id)}
                  />
                ))}
              </div>
            ) : null}
          </section>
        </div>

        <aside className="workspace-sidebar" aria-labelledby="progress-title">
          <section className="progress-panel">
            <div className="progress-panel-heading">
              <div>
                <p className="eyebrow">Ваш прогресс</p>
                <h2 id="progress-title">Освоение тем</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => void loadProgress()}
                aria-label="Обновить прогресс"
              >
                ↻
              </button>
            </div>

            {progressError ? <p className="inline-error">{progressError}</p> : null}

            {progress?.topics.length ? (
              <div className="mastery-list">
                {progress.topics.map((topic) => {
                  const percent = toPercent(topic.score);
                  return (
                    <div className="mastery-item" key={topic.topic}>
                      <div>
                        <span>{topic.topic}</span>
                        <strong>{percent}%</strong>
                      </div>
                      <div
                        className="mastery-track"
                        role="progressbar"
                        aria-label={`Освоение темы ${topic.topic}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={percent}
                      >
                        <span style={{ width: `${percent}%` }} />
                      </div>
                      <small>Попыток: {topic.attemptCount}</small>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="progress-empty">
                <span className="progress-empty-icon" aria-hidden="true">
                  <SparkIcon width={22} height={22} />
                </span>
                <p>Результаты появятся после ответов на вопросы теста.</p>
              </div>
            )}

            {progress?.weakestTopics.length ? (
              <div className="weak-topics">
                <h3>Темы для внимания</h3>
                <div>
                  {progress.weakestTopics.map((topic) => (
                    <span key={topic}>{topic}</span>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section className="sidebar-note">
            <DocumentIcon width={20} height={20} />
            <div>
              <strong>Источники ответа</strong>
              <p>Цитаты показываются только тогда, когда API вернул подтверждающие фрагменты.</p>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
