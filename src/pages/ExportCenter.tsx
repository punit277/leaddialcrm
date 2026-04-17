import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, FileSpreadsheet } from 'lucide-react';
import { LEAD_STATUSES, CALL_RESPONSES } from '@/lib/constants';
import { toast } from 'sonner';

export default function ExportCenter() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [scoreFilter, setScoreFilter] = useState('all');
  const [responseFilter, setResponseFilter] = useState('all');
  const [interestedOnly, setInterestedOnly] = useState(false);
  const [loading, setLoading] = useState(false);

  const exportCsv = async () => {
    setLoading(true);
    let query = supabase.from('leads').select('*');
    if (interestedOnly) query = query.eq('call_response', 'Interested');
    else {
      if (statusFilter !== 'all') query = query.eq('lead_status', statusFilter);
      if (scoreFilter !== 'all') query = query.eq('lead_score', parseInt(scoreFilter));
      if (responseFilter !== 'all') query = query.eq('call_response', responseFilter);
    }
    const { data, error } = await query;
    if (error || !data?.length) {
      toast.error(error?.message || 'No data to export');
      setLoading(false);
      return;
    }

    // Fetch last contacted agent for each lead
    const leadIds = data.map(d => d.id);
    const lastAgentMap = new Map<string, string>();

    // Fetch call logs ordered by time desc, grouped by lead
    for (let i = 0; i < leadIds.length; i += 500) {
      const chunk = leadIds.slice(i, i + 500);
      const { data: logs } = await supabase
        .from('call_logs')
        .select('lead_id, agent_id, called_at')
        .in('lead_id', chunk)
        .order('called_at', { ascending: false });

      if (logs) {
        const agentIds = [...new Set(logs.map(l => l.agent_id))];
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', agentIds);
        const nameMap = new Map(profiles?.map(p => [p.id, p.full_name || 'Unknown']) || []);

        logs.forEach(log => {
          if (!lastAgentMap.has(log.lead_id)) {
            lastAgentMap.set(log.lead_id, nameMap.get(log.agent_id) || 'Unknown');
          }
        });
      }
    }

    const headers = ['business_name', 'category', 'rating', 'reviews_count', 'address_full', 'open_status', 'lead_score', 'lead_status', 'call_response', 'maps_link', 'description', 'last_contacted_by'];
    const csv = [
      headers.join(','),
      ...data.map(row => {
        const values = headers.map(h => {
          if (h === 'last_contacted_by') return `"${lastAgentMap.get(row.id) ?? ''}"`;
          return `"${String((row as any)[h] ?? '').replace(/"/g, '""')}"`;
        });
        return values.join(',');
      })
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${data.length} leads`);
    setLoading(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Export Center</h1>
        <p className="text-sm text-muted-foreground">Download filtered leads as CSV</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Export Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox id="interested" checked={interestedOnly} onCheckedChange={v => setInterestedOnly(!!v)} />
            <label htmlFor="interested" className="text-sm font-medium cursor-pointer">Export "Interested" leads only (Hot Leads)</label>
          </div>

          {!interestedOnly && (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {LEAD_STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Score</label>
                <Select value={scoreFilter} onValueChange={setScoreFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="2">High</SelectItem>
                    <SelectItem value="1">Medium</SelectItem>
                    <SelectItem value="0">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Response</label>
                <Select value={responseFilter} onValueChange={setResponseFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {CALL_RESPONSES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <Button onClick={exportCsv} disabled={loading} className="gap-2">
            <Download className="h-4 w-4" />
            {loading ? 'Exporting...' : 'Export CSV'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
