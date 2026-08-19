import Link from 'next/link';
import {
  ArrowIcon,
  BookIcon,
  CheckIcon,
  DocumentIcon,
  InterviewIcon,
  SparkIcon,
} from '../components/Icons';

const steps = [
  {
    number: '01',
    title: 'Дайте материал',
    text: 'Выберите тему или загрузите PDF с текстом.',
  },
  {
    number: '02',
    title: 'Пройдите диагностику',
    text: 'Тренажёр найдёт сильные стороны и пробелы.',
  },
  {
    number: '03',
    title: 'Закрепите знания',
    text: 'Получайте уроки и вопросы именно по слабым темам.',
  },
];

export default function HomePage() {
  return (
    <main id="main-content" className="page-shell">
      <section className="hero-grid" aria-labelledby="hero-title">
        <div className="hero-card">
          <div className="eyebrow-row">
            <span className="eyebrow-icon" aria-hidden="true">
              <SparkIcon width={16} height={16} />
            </span>
            <span className="eyebrow">Обучение, которое подстраивается</span>
          </div>

          <h1 id="hero-title">
            От материала
            <br />
            <span>до уверенного ответа.</span>
          </h1>
          <p className="hero-copy">
            Соберите персональную программу, найдите слабые темы и тренируйтесь до тех пор, пока
            знания не станут вашими.
          </p>

          <div className="hero-actions">
            <Link className="button button-accent" href="/learn/new">
              Начать обучение
              <ArrowIcon width={19} height={19} />
            </Link>
            <Link className="button button-ghost" href="/interview/new">
              Пройти собеседование
            </Link>
          </div>

          <ul className="hero-benefits" aria-label="Преимущества">
            <li>
              <CheckIcon width={16} height={16} /> По вашим материалам
            </li>
            <li>
              <CheckIcon width={16} height={16} /> С объяснением ошибок
            </li>
            <li>
              <CheckIcon width={16} height={16} /> В вашем темпе
            </li>
          </ul>
        </div>

        <aside className="process-card" aria-labelledby="process-title">
          <div className="process-heading">
            <div>
              <p className="eyebrow">Ваш маршрут</p>
              <h2 id="process-title">Как это работает</h2>
            </div>
            <span className="live-badge">
              <span aria-hidden="true" /> AI
            </span>
          </div>

          <ol className="process-list">
            {steps.map((step) => (
              <li key={step.number}>
                <span className="step-number">{step.number}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="process-note">
            <span aria-hidden="true">↗</span>
            Следующее занятие строится по вашему прогрессу, а не по шаблону.
          </div>
        </aside>
      </section>

      <section className="section-block" aria-labelledby="start-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Быстрый старт</p>
            <h2 id="start-title">С чего начнём?</h2>
          </div>
          <p>Три сценария — одно пространство для роста.</p>
        </div>

        <div className="action-grid">
          <Link className="action-card action-card-lime" href="/learn/new?source=topic">
            <span className="action-icon">
              <BookIcon />
            </span>
            <span className="action-index">01</span>
            <div>
              <p className="card-kicker">Учиться с нуля</p>
              <h3>Выбрать тему</h3>
              <p>ИИ соберёт маршрут под ваш уровень и цель.</p>
            </div>
            <span className="card-link">
              Создать программу <ArrowIcon width={18} height={18} />
            </span>
          </Link>

          <Link className="action-card" href="/learn/new?source=document">
            <span className="action-icon action-icon-violet">
              <DocumentIcon />
            </span>
            <span className="action-index">02</span>
            <div>
              <p className="card-kicker">Разобрать своё</p>
              <h3>Загрузить PDF</h3>
              <p>Превратите лекцию или конспект в активную тренировку.</p>
            </div>
            <span className="card-link">
              Добавить материал <ArrowIcon width={18} height={18} />
            </span>
          </Link>

          <Link className="action-card action-card-dark" href="/interview/new">
            <span className="action-icon action-icon-dark">
              <InterviewIcon />
            </span>
            <span className="action-index">03</span>
            <div>
              <p className="card-kicker">Проверить себя</p>
              <h3>Собеседование</h3>
              <p>Практика вопросов и честный разбор ваших ответов.</p>
            </div>
            <span className="card-link">
              Начать тренировку <ArrowIcon width={18} height={18} />
            </span>
          </Link>
        </div>
      </section>

      <section className="empty-dashboard" aria-labelledby="progress-title">
        <div className="empty-visual" aria-hidden="true">
          <span className="orbit orbit-one" />
          <span className="orbit orbit-two" />
          <span className="orbit-center">
            <SparkIcon width={28} height={28} />
          </span>
        </div>
        <div className="empty-copy">
          <p className="eyebrow">Ваш прогресс</p>
          <h2 id="progress-title">Здесь появится карта знаний</h2>
          <p>
            После первого занятия вы увидите освоенные темы, зоны роста и рекомендацию, что
            повторить дальше.
          </p>
        </div>
        <Link className="text-link" href="/learn/new">
          Создать первую программу <ArrowIcon width={18} height={18} />
        </Link>
      </section>
    </main>
  );
}
