import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AppHeader } from '../components/AppHeader';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'wellll.ai — персональный AI-тренажёр',
    template: '%s · wellll.ai',
  },
  description:
    'Персональные программы обучения по документам и темам, а также тренировка собеседований с ИИ.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ru">
      <body>
        <a className="skip-link" href="#main-content">
          Перейти к содержимому
        </a>
        <div className="background-orb background-orb-one" aria-hidden="true" />
        <div className="background-orb background-orb-two" aria-hidden="true" />
        <AppHeader />
        {children}
      </body>
    </html>
  );
}
