import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface CampaignAllocation {
  campaignId: string;
  campaignName: string;
  count: number;
}

interface Props {
  allocations: CampaignAllocation[];
  totalRows: number;
  totalAllocated: number;
  unassigned: number;
  updateAllocation: (campaignId: string, count: number) => void;
}

export function CampaignDistribution({ allocations, totalRows, totalAllocated, unassigned, updateAllocation }: Props) {
  return (
    <div className="space-y-3">
      {allocations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active campaigns found. All leads will be imported without a campaign.</p>
      ) : (
        <>
          {allocations.map(a => (
            <div key={a.campaignId} className="flex items-center gap-3">
              <span className="text-sm font-medium flex-1 min-w-0 truncate">{a.campaignName}</span>
              <Input
                type="number"
                min={0}
                max={totalRows}
                value={a.count || ''}
                onChange={e => updateAllocation(a.campaignId, parseInt(e.target.value) || 0)}
                className="w-24 h-9 text-sm"
                placeholder="0"
              />
              <span className="text-xs text-muted-foreground w-12">leads</span>
            </div>
          ))}
          <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/50">
            <span className="text-sm font-medium">Summary</span>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-xs">Allocated: {totalAllocated}</Badge>
              <Badge variant={unassigned < 0 ? 'destructive' : 'secondary'} className="text-xs">
                {unassigned < 0 ? `Over by ${Math.abs(unassigned)}` : `Unassigned: ${unassigned}`}
              </Badge>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
