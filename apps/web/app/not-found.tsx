import Link from 'next/link';
import { ArrowIcon } from '../components/Icons';

export default function NotFoundPage() {
  return (
    <main id="main-content" className="centered-state">
      <span className="not-found-number" aria-hidden="true">
        404
      </span>
      <p className="eyebrow">Такой страницы нет</p>
      <h1>Кажется, мы свернули не туда</h1>
      <p>Вернитесь на главную и выберите подходящий формат тренировки.</p>
      <Link className="button button-dark" href="/">
        На главную <ArrowIcon width={18} height={18} />
      </Link>
    </main>
  );
}
