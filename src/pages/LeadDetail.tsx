import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LeadDetailCard } from '@/components/LeadDetailCard';
import { ArrowLeft, Phone, MessageSquare, Calendar, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface CallLog {
  id: string;
  response: string;
  notes: string | null;
  called_at: string;
  follow_up_date: string | null;
  agent_id: string;
  agent_name?: string;
}

const responseColors: Record<string, string> = {
  'Interested': 'bg-score-high text-primary-foreground',
  'Not Interested': 'bg-destructive text-destructive-foreground',
  'Follow Up': 'bg-score-medium text-primary-foreground',
  'Busy': 'bg-muted text-muted-foreground',
  'Not Connected': 'bg-muted text-muted-foreground',
  'Skip': 'bg-muted text-muted-foreground',
};

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role } = useAuth();
  const [lead, setLead] = useState<any | null>(null);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [reopening, setReopening] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      setLoading(true);

      const [leadRes, logsRes] = await Promise.all([
        supabase.from('leads').select('*').eq('id', id).maybeSingle(),
        supabase.from('call_logs').select('*').eq('lead_id', id).order('called_at', { ascending: false }),
      ]);

      if (!leadRes.data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setLead(leadRes.data);

      const logs = logsRes.data ?? [];
      if (logs.length > 0) {
        const agentIds = [...new Set(logs.map(l => l.agent_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', agentIds);

        const nameMap = new Map(profiles?.map(p => [p.id, p.full_name]) ?? []);
        setCallLogs(logs.map(l => ({ ...l, agent_name: nameMap.get(l.agent_id) ?? 'Unknown' })));
      } else {
        setCallLogs([]);
      }

      setLoading(false);
    };

    fetchData();
  }, [id]);

  const handleReopen = async () => {
    if (!lead) return;
    setReopening(true);
    await supabase.from('leads').update({
      lead_status: 'pending',
      assigned_to: null,
      assigned_at: null,
      call_response: null,
    }).eq('id', lead.id);
    setLead({ ...lead, lead_status: 'pending', assigned_to: null, assigned_at: null, call_response: null });
    toast.success('Lead reopened and returned to queue');
    setReopening(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Lead Not Found</h2>
          <p className="mt-1 text-sm text-muted-foreground">This lead doesn't exist or you don't have access.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </div>
    );
  }

  const canReopen = lead && ['completed', 'skipped', 'do_not_call'].includes(lead.lead_status);

  const allNotes = callLogs.filter(l => l.notes).map(l => ({
    note: l.notes!,
    agent: l.agent_name ?? 'Unknown',
    date: l.called_at,
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        {canReopen && (
          <Button variant="outline" size="sm" className="gap-2" disabled={reopening} onClick={handleReopen}>
            <RotateCcw className="h-4 w-4" /> Reopen Lead
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <LeadDetailCard lead={lead} />
        </CardContent>
      </Card>

      {/* Call History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Phone className="h-4 w-4" /> Call History
            <Badge variant="secondary" className="ml-auto">{callLogs.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {callLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No calls recorded yet.</p>
          ) : (
            <div className="relative space-y-0">
              <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />
              {callLogs.map((log) => (
                <div key={log.id} className="relative flex gap-4 pb-6 last:pb-0">
                  <div className="relative z-10 mt-1.5 h-[10px] w-[10px] shrink-0 rounded-full border-2 border-primary bg-background ml-[10px]" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={responseColors[log.response] ?? 'bg-muted text-muted-foreground'}>
                        {log.response}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        by <span className="font-medium text-foreground">{log.agent_name}</span>
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {format(new Date(log.called_at), 'PPP · p')}
                    </p>
                    {log.follow_up_date && (
                      <p className="mt-1 text-xs flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        Follow-up: {format(new Date(log.follow_up_date), 'PPP')}
                      </p>
                    )}
                    {log.notes && (
                      <div className="mt-2 rounded-md border bg-muted/50 p-2.5">
                        <p className="text-sm leading-relaxed">{log.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {allNotes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4" /> All Notes
              <Badge variant="secondary" className="ml-auto">{allNotes.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {allNotes.map((n, i) => (
              <div key={i} className="rounded-md border p-3">
                <p className="text-sm leading-relaxed">{n.note}</p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {n.agent} · {format(new Date(n.date), 'PPP')}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
