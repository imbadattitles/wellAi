'use client';

import type { FormEvent, KeyboardEvent } from 'react';
import { useState } from 'react';
import { ErrorNotice, SuccessPanel } from '../../../components/CreationFeedback';
import {
  ArrowIcon,
  CheckIcon,
  CloseIcon,
  InterviewIcon,
  SparkIcon,
} from '../../../components/Icons';
import {
  createInterview,
  getErrorMessage,
  type CreationResult,
  type InterviewInput,
} from '../../../lib/api-client';

type InterviewLevel = InterviewInput['level'];
type InterviewFormat = InterviewInput['format'];

const presets = [
  { label: 'Frontend', profession: 'Frontend-разработчик', technologies: ['JavaScript', 'React'] },
  { label: 'Backend', profession: 'Backend-разработчик', technologies: ['Node.js', 'PostgreSQL'] },
  {
    label: 'Product',
    profession: 'Product manager',
    technologies: ['Product discovery', 'Метрики'],
  },
];

export default function NewInterviewPage() {
  const [profession, setProfession] = useState('');
  const [level, setLevel] = useState<InterviewLevel>('middle');
  const [format, setFormat] = useState<InterviewFormat>('mixed');
  const [technologies, setTechnologies] = useState<string[]>([]);
  const [technologyDraft, setTechnologyDraft] = useState('');
  const [vacancyText, setVacancyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreationResult | null>(null);

  function addTechnologies(rawValue: string): string[] {
    const candidates = rawValue
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const nextTechnologies = [...technologies];

    for (const candidate of candidates) {
      if (
        nextTechnologies.length < 20 &&
        !nextTechnologies.some((item) => item.toLowerCase() === candidate.toLowerCase())
      ) {
        nextTechnologies.push(candidate.slice(0, 50));
      }
    }

    setTechnologies(nextTechnologies);
    setTechnologyDraft('');
    return nextTechnologies;
  }

  function handleTechnologyKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addTechnologies(technologyDraft);
    }
  }

  function removeTechnology(technology: string) {
    setTechnologies((current) => current.filter((item) => item !== technology));
  }

  function applyPreset(preset: (typeof presets)[number]) {
    setProfession(preset.profession);
    setTechnologies(preset.technologies);
    setTechnologyDraft('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const finalTechnologies = technologyDraft.trim()
      ? addTechnologies(technologyDraft)
      : technologies;

    try {
      const response = await createInterview({
        profession: profession.trim(),
        level,
        format,
        technologies: finalTechnologies,
        vacancyText: vacancyText.trim() || null,
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
          title="Интервью готовится"
          description="Мы собираем сценарий и карту компетенций под выбранную роль. Первый вопрос появится, когда сессия будет готова."
          againLabel="Настроить ещё одно"
          onAgain={() => setResult(null)}
          continueHref={
            result.sessionId || result.id
              ? `/interview/${result.sessionId ?? result.id}`
              : undefined
          }
          continueLabel="Перейти к интервью"
        />
      </main>
    );
  }

  return (
    <main id="main-content" className="form-page interview-page">
      <div className="form-intro interview-intro">
        <div>
          <p className="eyebrow">AI-собеседование</p>
          <h1>Потренируемся без лишнего стресса.</h1>
          <p>
            Настройте роль и формат. Вопросы будут подобраны под ваш уровень, а в конце вы получите
            честный разбор.
          </p>
        </div>
        <div className="interview-score-preview" aria-hidden="true">
          <span>Готовность</span>
          <strong>—</strong>
          <small>оценим после сессии</small>
        </div>
      </div>

      <div className="form-layout">
        <section className="form-card" aria-labelledby="interview-settings-title">
          <div className="form-card-heading">
            <div>
              <span className="form-step">Настройка · 3 минуты</span>
              <h2 id="interview-settings-title">Параметры интервью</h2>
            </div>
            <span className="secure-note">Без оценки со стороны людей</span>
          </div>

          {error ? <ErrorNotice message={error} /> : null}

          <form className="data-form" onSubmit={handleSubmit}>
            <div className="field-group">
              <label htmlFor="profession">Роль или профессия</label>
              <input
                id="profession"
                name="profession"
                type="text"
                minLength={2}
                maxLength={120}
                placeholder="Например, Middle Backend Developer"
                value={profession}
                onChange={(event) => setProfession(event.target.value)}
                disabled={isSubmitting}
                required
              />
              <div className="preset-row" aria-label="Популярные направления">
                {presets.map((preset) => (
                  <button
                    key={preset.label}
                    className="choice-pill"
                    type="button"
                    onClick={() => applyPreset(preset)}
                    disabled={isSubmitting}
                  >
                    + {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="two-column-fields">
              <div className="field-group">
                <label htmlFor="interview-level">Уровень</label>
                <select
                  id="interview-level"
                  name="level"
                  value={level}
                  onChange={(event) => setLevel(event.target.value as InterviewLevel)}
                  disabled={isSubmitting}
                >
                  <option value="junior">Junior</option>
                  <option value="middle">Middle</option>
                  <option value="senior">Senior</option>
                  <option value="lead">Lead</option>
                </select>
              </div>

              <div className="field-group">
                <label htmlFor="interview-format">Формат</label>
                <select
                  id="interview-format"
                  name="format"
                  value={format}
                  onChange={(event) => setFormat(event.target.value as InterviewFormat)}
                  disabled={isSubmitting}
                >
                  <option value="mixed">Смешанный</option>
                  <option value="technical">Технический</option>
                  <option value="behavioral">Поведенческий</option>
                </select>
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="technologies">Навыки и технологии</label>
              <div className="tag-input" data-filled={technologies.length > 0 || undefined}>
                {technologies.map((technology) => (
                  <span className="technology-tag" key={technology}>
                    {technology}
                    <button
                      type="button"
                      onClick={() => removeTechnology(technology)}
                      aria-label={`Удалить ${technology}`}
                      disabled={isSubmitting}
                    >
                      <CloseIcon width={14} height={14} />
                    </button>
                  </span>
                ))}
                <input
                  id="technologies"
                  name="technologies"
                  type="text"
                  maxLength={50}
                  placeholder={
                    technologies.length ? 'Добавить ещё' : 'Node.js, PostgreSQL, архитектура'
                  }
                  value={technologyDraft}
                  onChange={(event) => setTechnologyDraft(event.target.value)}
                  onKeyDown={handleTechnologyKeyDown}
                  disabled={isSubmitting || technologies.length >= 20}
                  aria-describedby="technologies-hint"
                />
              </div>
              <span id="technologies-hint" className="field-hint">
                Нажмите Enter после каждого навыка или разделите их запятыми.
              </span>
            </div>

            <div className="field-group">
              <div className="label-row">
                <label htmlFor="vacancy">Текст вакансии</label>
                <span>Необязательно</span>
              </div>
              <textarea
                id="vacancy"
                name="vacancyText"
                maxLength={20000}
                rows={5}
                placeholder="Вставьте описание вакансии — вопросы станут точнее"
                value={vacancyText}
                onChange={(event) => setVacancyText(event.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <button
              className="button button-dark button-wide"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner" aria-hidden="true" /> Готовим сценарий…
                </>
              ) : (
                <>
                  Начать собеседование <ArrowIcon width={19} height={19} />
                </>
              )}
            </button>
          </form>
        </section>

        <aside className="form-aside interview-aside" aria-labelledby="interview-aside-title">
          <span className="aside-spark" aria-hidden="true">
            <InterviewIcon width={23} height={23} />
          </span>
          <p className="eyebrow">Репетиция в безопасной среде</p>
          <h2 id="interview-aside-title">Что вы получите</h2>
          <ul className="benefit-checklist">
            <li>
              <CheckIcon width={18} height={18} />
              <span>Вопросы под вашу роль и уровень</span>
            </li>
            <li>
              <CheckIcon width={18} height={18} />
              <span>Оценку конкретных компетенций</span>
            </li>
            <li>
              <CheckIcon width={18} height={18} />
              <span>Разбор сильных формулировок и пробелов</span>
            </li>
            <li>
              <CheckIcon width={18} height={18} />
              <span>План подготовки к следующей попытке</span>
            </li>
          </ul>

          <div className="coach-quote">
            <SparkIcon width={18} height={18} />
            <p>
              «Я буду оценивать содержание ответа, а не скорость печати. Можно спокойно подумать».
            </p>
            <span>Ваш AI-интервьюер</span>
          </div>
        </aside>
      </div>
    </main>
  );
}
