import { cn } from '@/lib/utils';

const statusStyles: Record<string, string> = {
  pending: 'bg-score-medium/15 text-score-medium',
  assigned: 'bg-primary/15 text-primary',
  completed: 'bg-score-high/15 text-score-high',
  follow_up: 'bg-score-medium/15 text-score-medium',
  skipped: 'bg-muted text-muted-foreground',
  do_not_call: 'bg-destructive/15 text-destructive',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize', statusStyles[status] ?? statusStyles.pending)}>
      {status.replace('_', ' ')}
    </span>
  );
}
