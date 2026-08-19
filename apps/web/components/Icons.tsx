import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const commonProps: IconProps = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

export function ArrowIcon(props: IconProps) {
  return (
    <svg {...commonProps} {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function BookIcon(props: IconProps) {
  return (
    <svg {...commonProps} {...props}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5z" />
      <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5z" />
    </svg>
  );
}

export function DocumentIcon(props: IconProps) {
  return (
    <svg {...commonProps} {...props}>
      <path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M14 3v5h4M9 13h6M9 17h4" />
    </svg>
  );
}

export function InterviewIcon(props: IconProps) {
  return (
    <svg {...commonProps} {...props}>
      <path d="M15 18.5c3-.7 5-2.5 5-5.5 0-3.9-3.6-7-8-7s-8 3.1-8 7 3.6 7 8 7c.7 0 1.3-.1 2-.2l4 2.2z" />
      <path d="M8.5 13h.01M12 13h.01M15.5 13h.01" />
    </svg>
  );
}

export function SparkIcon(props: IconProps) {
  return (
    <svg {...commonProps} {...props}>
      <path d="m12 3 1.4 4.1a5.5 5.5 0 0 0 3.5 3.5L21 12l-4.1 1.4a5.5 5.5 0 0 0-3.5 3.5L12 21l-1.4-4.1a5.5 5.5 0 0 0-3.5-3.5L3 12l4.1-1.4a5.5 5.5 0 0 0 3.5-3.5z" />
    </svg>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <svg {...commonProps} {...props}>
      <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...commonProps} {...props}>
      <path d="m5 12.5 4.2 4L19 7" />
    </svg>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <svg {...commonProps} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16.5h.01" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...commonProps} {...props}>
      <path d="m7 7 10 10M17 7 7 17" />
    </svg>
  );
}
