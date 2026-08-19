import Link from 'next/link';
import { SparkIcon } from './Icons';

export function AppHeader() {
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" href="/" aria-label="wellll.ai — на главную">
          <span className="brand-mark" aria-hidden="true">
            <SparkIcon width={18} height={18} />
          </span>
          <span>wellll.ai</span>
        </Link>

        <nav className="main-nav" aria-label="Основная навигация">
          <Link href="/learn/new">Обучение</Link>
          <Link href="/interview/new">Собеседования</Link>
        </nav>

        <Link className="header-action" href="/learn/new">
          Новая программа
          <span aria-hidden="true">+</span>
        </Link>
      </div>
    </header>
  );
}
