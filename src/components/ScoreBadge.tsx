import { cn } from '@/lib/utils';
import { LEAD_SCORE_LABELS } from '@/lib/constants';

export function ScoreBadge({ score }: { score: number }) {
  const colors: Record<number, string> = {
    0: 'bg-score-low/15 text-score-low',
    1: 'bg-score-medium/15 text-score-medium',
    2: 'bg-score-high/15 text-score-high',
  };
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold', colors[score] ?? colors[0])}>
      {LEAD_SCORE_LABELS[score] ?? 'Low'}
    </span>
  );
}
