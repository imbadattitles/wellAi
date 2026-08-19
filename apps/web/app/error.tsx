'use client';

import { useEffect } from 'react';
import { AlertIcon } from '../components/Icons';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main-content" className="centered-state">
      <span className="state-illustration state-illustration-error" aria-hidden="true">
        <AlertIcon width={34} height={34} />
      </span>
      <p className="eyebrow">Небольшая пауза</p>
      <h1>Страница не загрузилась</h1>
      <p>Попробуйте повторить запрос. Ваши данные останутся на месте.</p>
      <button className="button button-dark" type="button" onClick={reset}>
        Попробовать снова
      </button>
    </main>
  );
}
