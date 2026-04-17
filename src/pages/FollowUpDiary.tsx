import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Phone, CalendarClock, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { format, formatDistanceToNow, isPast, differenceInMinutes } from 'date-fns';
import { toast } from 'sonner';

interface FollowUpLead {
  id: string;
  business_name: string;
  phone_number: string | null;
  category: string | null;
  call_response: string | null;
  called_at: string | null;
  follow_up_date: string | null;
  lead_status: string;
  last_notes: string | null;
  agent_name: string | null;
  agent_id: string | null;
}

function CallbackTimer({ followUpDate, calledAt }: { followUpDate: string | null; calledAt: string | null }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  if (followUpDate) {
    const date = new Date(followUpDate);
    const overdue = isPast(date);
    const mins = Math.abs(differenceInMinutes(new Date(), date));
    const hours = Math.floor(mins / 60);
    const remainMins = mins % 60;
    const timeStr = hours > 0 ? `${hours}h ${remainMins}m` : `${remainMins}m`;

    if (overdue) {
      return (
        <div className="flex items-center gap-1.5 text-destructive text-xs font-semibold">
          <AlertTriangle className="h-3.5 w-3.5" />
          Overdue by {timeStr}
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 text-primary text-xs font-semibold">
        <Clock className="h-3.5 w-3.5" />
        Call back in {timeStr}
      </div>
    );
  }

  if (calledAt) {
    return (
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
        <Clock className="h-3.5 w-3.5" />
        Last called {formatDistanceToNow(new Date(calledAt), { addSuffix: true })}
      </div>
    );
  }

  return null;
}

export default function FollowUpDiary() {
  const { user, role } = useAuth();
  const [leads, setLeads] = useState<FollowUpLead[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFollowUps = useCallback(async () => {
    setLoading(true);

    // Get leads that are follow_up or have interested/follow up response
    let query = supabase
      .from('leads')
      .select('id, business_name, phone_number, category, call_response, called_at, follow_up_date, lead_status')
      .or('lead_status.eq.follow_up,call_response.in.(Interested,Follow Up)')
      .neq('lead_status', 'skipped');

    const { data: leadsData } = await query;
    if (!leadsData || leadsData.length === 0) {
      setLeads([]);
      setLoading(false);
      return;
    }

    // Get latest call_log for each lead to get notes and agent
    const leadIds = leadsData.map(l => l.id);
    const { data: logs } = await supabase
      .from('call_logs')
      .select('lead_id, notes, agent_id, called_at')
      .in('lead_id', leadIds)
      .order('called_at', { ascending: false });

    // Get agent profiles if admin
    let profileMap: Record<string, string> = {};
    if (role === 'admin' && logs) {
      const agentIds = [...new Set(logs.map(l => l.agent_id))];
      if (agentIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', agentIds);
        profiles?.forEach(p => { profileMap[p.id] = p.full_name || 'Unknown'; });
      }
    }

    // Map latest log per lead
    const latestLogMap: Record<string, typeof logs extends (infer T)[] | null ? T : never> = {};
    logs?.forEach(log => {
      if (!latestLogMap[log.lead_id]) latestLogMap[log.lead_id] = log;
    });

    let result: FollowUpLead[] = leadsData.map(lead => {
      const log = latestLogMap[lead.id];
      return {
        ...lead,
        last_notes: log?.notes || null,
        agent_name: log ? (profileMap[log.agent_id] || null) : null,
        agent_id: log?.agent_id || null,
      };
    });

    // Filter agent view to own leads only
    if (role === 'agent') {
      result = result.filter(r => r.agent_id === user?.id);
    }

    // Sort: overdue first, then soonest follow_up_date, then most recent call
    result.sort((a, b) => {
      const aDate = a.follow_up_date ? new Date(a.follow_up_date) : null;
      const bDate = b.follow_up_date ? new Date(b.follow_up_date) : null;
      const aOverdue = aDate ? isPast(aDate) : false;
      const bOverdue = bDate ? isPast(bDate) : false;

      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      if (aDate && bDate) return aDate.getTime() - bDate.getTime();
      if (aDate && !bDate) return -1;
      if (!aDate && bDate) return 1;

      const aCalled = a.called_at ? new Date(a.called_at).getTime() : 0;
      const bCalled = b.called_at ? new Date(b.called_at).getTime() : 0;
      return bCalled - aCalled;
    });

    setLeads(result);
    setLoading(false);
  }, [user, role]);

  useEffect(() => { fetchFollowUps(); }, [fetchFollowUps]);

  const setFollowUpDate = async (leadId: string, date: Date | undefined) => {
    if (!date) return;
    await supabase.from('leads').update({ follow_up_date: date.toISOString() }).eq('id', leadId);
    toast.success('Follow-up date set');
    fetchFollowUps();
  };

  const markCompleted = async (leadId: string) => {
    await supabase.from('leads').update({ lead_status: 'completed', follow_up_date: null }).eq('id', leadId);
    toast.success('Marked as completed');
    fetchFollowUps();
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 animate-slide-in">
      <div className="text-center mb-6">
        <h1 className="text-xl font-bold tracking-tight">Follow-Up Diary</h1>
        <p className="text-sm text-muted-foreground">
          {leads.length} follow-up{leads.length !== 1 ? 's' : ''} pending
        </p>
      </div>

      {leads.length === 0 ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="text-center">
            <CalendarClock className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
            <h2 className="text-lg font-semibold">No Follow-Ups</h2>
            <p className="mt-1 text-sm text-muted-foreground">All caught up! No pending follow-ups.</p>
          </div>
        </div>
      ) : (
        leads.map(lead => (
          <Card key={lead.id} className="overflow-hidden">
            <CardContent className="pt-4 pb-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-base leading-tight truncate">{lead.business_name}</h3>
                  {lead.category && (
                    <span className="inline-block rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground mt-1">
                      {lead.category}
                    </span>
                  )}
                </div>
                <span className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                  lead.call_response === 'Interested'
                    ? 'bg-score-high/15 text-score-high'
                    : 'bg-score-medium/15 text-score-medium'
                )}>
                  {lead.call_response}
                </span>
              </div>

              <CallbackTimer followUpDate={lead.follow_up_date} calledAt={lead.called_at} />

              {lead.follow_up_date && (
                <p className="text-xs text-muted-foreground">
                  📅 {format(new Date(lead.follow_up_date), 'PPP p')}
                </p>
              )}

              {lead.last_notes && (
                <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2 leading-relaxed">
                  {lead.last_notes}
                </p>
              )}

              {role === 'admin' && lead.agent_name && (
                <p className="text-xs text-muted-foreground">Agent: {lead.agent_name}</p>
              )}

              <div className="flex gap-2 pt-1">
                {lead.phone_number && (
                  <Button variant="outline" size="sm" className="gap-1.5 min-h-[44px] flex-1" asChild>
                    <a href={`tel:${lead.phone_number}`}>
                      <Phone className="h-3.5 w-3.5" /> Call
                    </a>
                  </Button>
                )}

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5 min-h-[44px] flex-1">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {lead.follow_up_date ? 'Reschedule' : 'Schedule'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="center">
                    <Calendar
                      mode="single"
                      selected={lead.follow_up_date ? new Date(lead.follow_up_date) : undefined}
                      onSelect={(date) => setFollowUpDate(lead.id, date)}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>

                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 min-h-[44px]"
                  onClick={() => markCompleted(lead.id)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
