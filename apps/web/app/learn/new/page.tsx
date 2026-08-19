'use client';

import type { ChangeEvent, DragEvent, FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { ErrorNotice, SuccessPanel } from '../../../components/CreationFeedback';
import {
  ArrowIcon,
  BookIcon,
  DocumentIcon,
  SparkIcon,
  UploadIcon,
} from '../../../components/Icons';
import {
  createDocumentProgram,
  createTopicProgram,
  getErrorMessage,
  type CreationResult,
} from '../../../lib/api-client';

type SourceMode = 'topic' | 'document';
type TopicLevel = 'beginner' | 'intermediate' | 'advanced';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function formatFileSize(size: number): string {
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} КБ`;
  return `${(size / (1024 * 1024)).toFixed(1)} МБ`;
}

function isPdf(file: File): boolean {
  return file.type === 'application/pdf';
}

export default function NewLearningProgramPage() {
  const [mode, setMode] = useState<SourceMode>('topic');
  const [topic, setTopic] = useState('');
  const [goal, setGoal] = useState('');
  const [level, setLevel] = useState<TopicLevel>('beginner');
  const [documentTitle, setDocumentTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreationResult | null>(null);

  useEffect(() => {
    const source = new URLSearchParams(window.location.search).get('source');
    if (source === 'document' || source === 'topic') setMode(source);
  }, []);

  function selectMode(nextMode: SourceMode) {
    if (isSubmitting) return;
    setMode(nextMode);
    setError(null);
  }

  function acceptFile(nextFile: File | undefined) {
    setError(null);
    if (!nextFile) return;

    if (!isPdf(nextFile)) {
      setFile(null);
      setError('Браузер должен распознать файл как PDF. Выберите другой файл.');
      return;
    }

    if (nextFile.size > MAX_FILE_SIZE) {
      setFile(null);
      setError('Файл больше 10 МБ. Выберите документ меньшего размера.');
      return;
    }

    setFile(nextFile);
    setDocumentTitle((currentTitle) => currentTitle || nextFile.name.replace(/\.pdf$/i, ''));
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    acceptFile(event.target.files?.[0]);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    acceptFile(event.dataTransfer.files?.[0]);
  }

  async function handleTopicSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await createTopicProgram({
        topic: topic.trim(),
        goal: goal.trim(),
        level,
        language: 'ru',
      });
      setResult(response);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDocumentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!file) {
      setError('Сначала выберите PDF-файл.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await createDocumentProgram({
        title: documentTitle.trim(),
        file,
        language: 'ru',
      });
      setResult(response);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (result) {
    return (
      <main id="main-content" className="form-page form-page-centered">
        <SuccessPanel
          result={result}
          title="Программа создаётся"
          description="Мы уже собираем структуру материала. Когда она будет готова, можно будет пройти диагностику и начать первое занятие."
          againLabel="Создать ещё одну"
          onAgain={() => setResult(null)}
          continueHref={
            result.programId || result.id ? `/learn/${result.programId ?? result.id}` : undefined
          }
          continueLabel="Открыть программу"
        />
      </main>
    );
  }

  return (
    <main id="main-content" className="form-page">
      <div className="form-intro">
        <p className="eyebrow">Новая программа</p>
        <h1>Что хотите изучить?</h1>
        <p>
          Начните с интересующей темы или превратите свой документ в персональный учебный маршрут.
        </p>

        <div className="mini-steps" aria-label="Этапы создания программы">
          <span className="mini-step mini-step-active">
            <b>1</b> Материал
          </span>
          <span className="mini-step-line" aria-hidden="true" />
          <span className="mini-step">
            <b>2</b> Диагностика
          </span>
          <span className="mini-step-line" aria-hidden="true" />
          <span className="mini-step">
            <b>3</b> Занятие
          </span>
        </div>
      </div>

      <div className="form-layout">
        <section className="form-card" aria-labelledby="source-title">
          <div className="form-card-heading">
            <div>
              <span className="form-step">Шаг 1 из 3</span>
              <h2 id="source-title">Выберите источник</h2>
            </div>
            <span className="secure-note">Только для вашей программы</span>
          </div>

          <div className="source-switch" aria-label="Источник материала">
            <button
              className={mode === 'topic' ? 'source-option source-option-active' : 'source-option'}
              type="button"
              aria-pressed={mode === 'topic'}
              onClick={() => selectMode('topic')}
            >
              <span className="source-option-icon">
                <BookIcon width={22} height={22} />
              </span>
              <span>
                <strong>Выбрать тему</strong>
                <small>Программа с нуля</small>
              </span>
            </button>
            <button
              className={
                mode === 'document' ? 'source-option source-option-active' : 'source-option'
              }
              type="button"
              aria-pressed={mode === 'document'}
              onClick={() => selectMode('document')}
            >
              <span className="source-option-icon">
                <DocumentIcon width={22} height={22} />
              </span>
              <span>
                <strong>Загрузить PDF</strong>
                <small>Учиться по своему материалу</small>
              </span>
            </button>
          </div>

          {error ? <ErrorNotice message={error} /> : null}

          {mode === 'topic' ? (
            <form className="data-form" onSubmit={handleTopicSubmit}>
              <div className="field-group">
                <label htmlFor="topic">Тема</label>
                <input
                  id="topic"
                  name="topic"
                  type="text"
                  minLength={3}
                  maxLength={200}
                  placeholder="Например, основы PostgreSQL"
                  autoComplete="off"
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  disabled={isSubmitting}
                  required
                />
                <span className="field-hint">
                  Сформулируйте тему конкретно — так маршрут будет точнее.
                </span>
              </div>

              <fieldset className="field-group">
                <legend>Ваш текущий уровень</legend>
                <div className="segmented-control">
                  <label>
                    <input
                      type="radio"
                      name="level"
                      value="beginner"
                      checked={level === 'beginner'}
                      onChange={() => setLevel('beginner')}
                      disabled={isSubmitting}
                    />
                    <span>Начинаю</span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="level"
                      value="intermediate"
                      checked={level === 'intermediate'}
                      onChange={() => setLevel('intermediate')}
                      disabled={isSubmitting}
                    />
                    <span>Знаю основы</span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="level"
                      value="advanced"
                      checked={level === 'advanced'}
                      onChange={() => setLevel('advanced')}
                      disabled={isSubmitting}
                    />
                    <span>Углубляюсь</span>
                  </label>
                </div>
              </fieldset>

              <div className="field-group">
                <div className="label-row">
                  <label htmlFor="goal">Цель обучения</label>
                  <span>{goal.length}/500</span>
                </div>
                <textarea
                  id="goal"
                  name="goal"
                  minLength={3}
                  maxLength={500}
                  rows={4}
                  placeholder="Например: уверенно проектировать схему базы для backend-приложения"
                  value={goal}
                  onChange={(event) => setGoal(event.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>

              <button
                className="button button-dark button-wide"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="spinner" aria-hidden="true" /> Собираем запрос…
                  </>
                ) : (
                  <>
                    Создать программу <ArrowIcon width={19} height={19} />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form className="data-form" onSubmit={handleDocumentSubmit}>
              <div className="field-group">
                <label htmlFor="document-title">Название программы</label>
                <input
                  id="document-title"
                  name="title"
                  type="text"
                  minLength={1}
                  maxLength={200}
                  placeholder="Например, подготовка к экзамену по сетям"
                  value={documentTitle}
                  onChange={(event) => setDocumentTitle(event.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>

              <div className="field-group">
                <span className="field-label">Учебный материал</span>
                <label
                  className={file ? 'drop-zone drop-zone-selected' : 'drop-zone'}
                  htmlFor="pdf-file"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleDrop}
                >
                  <input
                    id="pdf-file"
                    name="file"
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileChange}
                    disabled={isSubmitting}
                  />
                  <span className="upload-icon" aria-hidden="true">
                    {file ? (
                      <DocumentIcon width={28} height={28} />
                    ) : (
                      <UploadIcon width={28} height={28} />
                    )}
                  </span>
                  {file ? (
                    <span className="drop-zone-copy">
                      <strong>{file.name}</strong>
                      <small>{formatFileSize(file.size)} · нажмите, чтобы заменить</small>
                    </span>
                  ) : (
                    <span className="drop-zone-copy">
                      <strong>Перетащите PDF сюда</strong>
                      <small>или нажмите, чтобы выбрать · до 10 МБ</small>
                    </span>
                  )}
                </label>
                <span className="field-hint">Для MVP нужен PDF с текстовым слоем, не скан.</span>
              </div>

              <button
                className="button button-dark button-wide"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="spinner" aria-hidden="true" /> Загружаем материал…
                  </>
                ) : (
                  <>
                    Загрузить и создать <ArrowIcon width={19} height={19} />
                  </>
                )}
              </button>
            </form>
          )}
        </section>

        <aside className="form-aside" aria-labelledby="aside-title">
          <span className="aside-spark" aria-hidden="true">
            <SparkIcon width={22} height={22} />
          </span>
          <p className="eyebrow">Что будет дальше</p>
          <h2 id="aside-title">Маршрут, а не набор случайных вопросов</h2>
          <ul className="aside-list">
            <li>
              <span>1</span>
              <div>
                <strong>Карта тем</strong>
                <p>Разложим материал на понятные смысловые блоки.</p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Диагностика</strong>
                <p>Определим, что уже знаете и где есть пробелы.</p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Следующий урок</strong>
                <p>Сфокусируемся на теме, которая даст наибольший рост.</p>
              </div>
            </li>
          </ul>
          <div className="privacy-note">
            <strong>Важно</strong>
            <p>Не загружайте документы с паролями и другими секретными данными.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
