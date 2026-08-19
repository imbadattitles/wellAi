import Link from 'next/link';
import type { CreationResult } from '../lib/api-client';
import { AlertIcon, ArrowIcon, CheckIcon } from './Icons';

interface ErrorNoticeProps {
  message: string;
}

export function ErrorNotice({ message }: ErrorNoticeProps) {
  return (
    <div className="notice notice-error" role="alert">
      <span className="notice-icon">
        <AlertIcon width={20} height={20} />
      </span>
      <div>
        <strong>Не получилось отправить запрос</strong>
        <p>{message}</p>
      </div>
    </div>
  );
}

interface SuccessPanelProps {
  result: CreationResult;
  title: string;
  description: string;
  againLabel: string;
  onAgain: () => void;
  continueHref?: string | undefined;
  continueLabel?: string;
}

export function SuccessPanel({
  result,
  title,
  description,
  againLabel,
  onAgain,
  continueHref,
  continueLabel = 'Открыть',
}: SuccessPanelProps) {
  const reference = result.operationId || result.programId || result.sessionId || result.id;

  return (
    <section className="success-panel" aria-labelledby="success-title">
      <span className="success-icon" aria-hidden="true">
        <CheckIcon width={30} height={30} />
      </span>
      <p className="eyebrow">Запрос принят</p>
      <h1 id="success-title">{title}</h1>
      <p className="success-description">{description}</p>

      {reference ? (
        <div className="reference-row">
          <span>Идентификатор</span>
          <code>{reference}</code>
        </div>
      ) : null}

      <div className="success-actions">
        {continueHref ? (
          <Link className="button button-dark" href={continueHref}>
            {continueLabel}
            <ArrowIcon width={18} height={18} />
          </Link>
        ) : null}
        <button
          className={continueHref ? 'button button-secondary' : 'button button-dark'}
          type="button"
          onClick={onAgain}
        >
          {againLabel}
        </button>
        <Link className="success-home-link" href="/">
          На главную
        </Link>
      </div>
    </section>
  );
}
