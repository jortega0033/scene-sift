import { cn } from '@renderer/lib/cn';

type StatusPillProps = {
  label: string;
  status: 'ok' | 'warning' | 'neutral';
};

const statusStyles = {
  ok: 'border-border bg-background text-foreground',
  warning: 'border-border bg-muted text-foreground',
  neutral: 'border-border bg-card text-muted-foreground',
};

export const StatusPill = ({ label, status }: StatusPillProps) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-label',
      statusStyles[status],
    )}
  >
    <span aria-hidden="true" className="text-dot">
      {status === 'ok' ? '●' : status === 'warning' ? '◐' : '○'}
    </span>
    <span>{label}</span>
  </span>
);
