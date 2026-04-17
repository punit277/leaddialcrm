import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSilentRecorder } from '@/hooks/useSilentRecorder';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { LeadDetailCard } from '@/components/LeadDetailCard';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CALL_RESPONSES, CallResponse } from '@/lib/constants';
import { cn } from '@/lib/utils';
import {
  Phone,
  MessageSquare,
  SkipForward,
  CalendarClock,
  ExternalLink,
  ArrowRight,
  PartyPopper,
  Loader2,
  PhoneCall,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const compareLeadPriority = (a: any, b: any) => {
  if ((b.lead_score ?? 0) !== (a.lead_score ?? 0))
    return (b.lead_score ?? 0) - (a.lead_score ?? 0);
  if ((a.skip_count ?? 0) !== (b.skip_count ?? 0))
    return (a.skip_count ?? 0) - (b.skip_count ?? 0);
  if ((b.reviews_count ?? -1) !== (a.reviews_count ?? -1))
    return (b.reviews_count ?? -1) - (a.reviews_count ?? -1);
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
};

export default function AgentCallQueue() {
  const { user, profile } = useAuth();
  const [lead, setLead] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [followUpDate, setFollowUpDate] = useState<Date | undefined>(undefined);
  const [pendingResponse, setPendingResponse] = useState<CallResponse | null>(null);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  // Track whether agent has initiated the call
  const [callStarted, setCallStarted] = useState(false);
  const submittingRef = useRef(false);

  const recorder = useSilentRecorder();

  // ─── Load existing assigned lead ─────────────────────────────────────────
  const loadOrFetchLead = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: existing, error } = await supabase
      .from('leads')
      .select('*')
      .eq('assigned_to', user.id)
      .eq('lead_status', 'assigned')
      .limit(1);

    if (error) {
      toast.error('Failed to load your current lead. Please refresh.');
      setLoading(false);
      return;
    }
    if (existing && existing.length > 0) {
      setLead(existing[0]);
    } else {
      setLead(null);
    }
    setLoading(false);
  }, [user]);

  // ─── Fetch next lead ──────────────────────────────────────────────────────
  const fetchNext = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setNotes('');
    setShowNotes(false);
    setFollowUpDate(undefined);
    setPendingResponse(null);
    setCallStarted(false);
    recorder.reset();

    const { data: assignments, error: assignmentsError } = await supabase
      .from('campaign_assignments')
      .select('campaign_id')
      .eq('agent_id', user.id);

    if (assignmentsError) {
      toast.error('Failed to load campaign assignments.');
      setLoading(false);
      return;
    }

    const campaignIds = assignments?.map((a) => a.campaign_id) ?? [];
    const nowIso = new Date().toISOString();

    const buildCandidateQuery = () => {
      let query = supabase
        .from('leads')
        .select('*')
        .is('assigned_to', null)
        .order('lead_score', { ascending: false })
        .order('skip_count', { ascending: true })
        .order('reviews_count', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: true })
        .limit(1);
      if (campaignIds.length > 0) query = query.in('campaign_id', campaignIds);
      return query;
    };

    const [{ data: pendingLeads, error: pendingError }, { data: dueFollowUps, error: followUpError }] =
      await Promise.all([
        buildCandidateQuery().eq('lead_status', 'pending').is('call_response', null),
        buildCandidateQuery()
          .eq('lead_status', 'follow_up')
          .not('follow_up_date', 'is', null)
          .lte('follow_up_date', nowIso),
      ]);

    if (pendingError || followUpError) {
      toast.error('Failed to fetch the next lead.');
      setLoading(false);
      return;
    }

    const nextLead = [...(pendingLeads ?? []), ...(dueFollowUps ?? [])]
      .sort(compareLeadPriority)[0];

    if (nextLead) {
      const { data: claimResult, error: claimError } = await supabase.rpc('claim_lead', {
        p_lead_id: nextLead.id,
        p_agent_id: user.id,
      });
      if (claimError) {
        toast.error('Could not assign the next lead. Please try again.');
        setLoading(false);
        return;
      }
      const result = claimResult as any;
      if (!result?.success) {
        setLead(null);
        setLoading(false);
        toast.message('That lead was just claimed by another agent. Tap Get Next Lead to continue.');
        return;
      }
      setLead(result.lead);
    } else {
      setLead(null);
      if (campaignIds.length > 0) {
        const [pendingCountRes, dueFollowUpCountRes, assignedCountRes] = await Promise.all([
          supabase
            .from('leads')
            .select('id', { count: 'exact', head: true })
            .in('campaign_id', campaignIds)
            .eq('lead_status', 'pending')
            .is('call_response', null),
          supabase
            .from('leads')
            .select('id', { count: 'exact', head: true })
            .in('campaign_id', campaignIds)
            .eq('lead_status', 'follow_up')
            .not('follow_up_date', 'is', null)
            .lte('follow_up_date', nowIso),
          supabase
            .from('leads')
            .select('id', { count: 'exact', head: true })
            .in('campaign_id', campaignIds)
            .eq('lead_status', 'assigned'),
        ]);
        const remaining =
          (pendingCountRes.count ?? 0) +
          (dueFollowUpCountRes.count ?? 0) +
          (assignedCountRes.count ?? 0);
        if (remaining === 0) setShowCompletionDialog(true);
      }
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadOrFetchLead();
  }, [loadOrFetchLead]);

  // ─── Start Call: open dialer + begin silent recording ────────────────────
  const handleStartCall = async () => {
    if (!lead) return;
    // Open phone dialer
    if (lead.phone_number) {
      window.open(`tel:${lead.phone_number}`);
    }
    // Start silent recording in background
    const ok = await recorder.start();
    if (!ok) {
      // Mic permission denied — let agent proceed but warn
      toast.warning('Mic access denied. Call will proceed without recording.');
    }
    setCallStarted(true);
  };

  // ─── Dispose flow ─────────────────────────────────────────────────────────
  const handleResponse = (response: CallResponse) => {
    if (!callStarted) {
      toast.error('Please start the call first.');
      return;
    }
    if (response === 'Interested' || response === 'Follow Up') {
      if (!pendingResponse) {
        setPendingResponse(response);
        return;
      }
    }
    submitResponse(response);
  };

  const submitResponse = async (response: CallResponse) => {
    if (!lead || !user || submittingRef.current) return;
    if (!callStarted) {
      toast.error('Please start the call first.');
      return;
    }

    setSubmitting(true);
    submittingRef.current = true;

    // Stop recording + upload to Telegram (silently in background)
    const agentName = profile?.full_name || user?.email || 'Unknown Agent';
    const leadName = lead.business_name || 'Unknown Lead';
    await recorder.stopAndUpload(agentName, leadName);

    // Now dispose
    const scheduledFollowUp = followUpDate ? followUpDate.toISOString() : null;
    const skipCount =
      response === 'Skip' ? (lead.skip_count || 0) + 1 : lead.skip_count || 0;
    const notConnectedCount =
      response === 'Not Connected'
        ? (lead.not_connected_count || 0) + 1
        : lead.not_connected_count || 0;

    const { data, error } = await supabase.rpc('dispose_lead', {
      p_lead_id: lead.id,
      p_agent_id: user.id,
      p_call_response: response,
      p_notes: notes || null,
      p_follow_up_date: scheduledFollowUp,
      p_skip_count: skipCount,
      p_not_connected_count: notConnectedCount,
    });

    if (error) {
      toast.error('Something went wrong. Please try again.');
      setSubmitting(false);
      submittingRef.current = false;
      return;
    }

    const result = data as any;
    if (result && !result.success) {
      toast.error('Something went wrong. Please try again.');
      setSubmitting(false);
      submittingRef.current = false;
      return;
    }

    toast.success(`Response recorded: ${response}`);
    setSubmitting(false);
    submittingRef.current = false;
    setPendingResponse(null);
    setFollowUpDate(undefined);
    setCallStarted(false);
    recorder.reset();
    setLead(null);
    setLoading(false);
  };

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading next lead...</p>
        </div>
      </div>
    );
  }

  // ─── No lead ──────────────────────────────────────────────────────────────
  if (!lead) {
    return (
      <>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <Phone className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
            <h2 className="text-xl font-semibold">No Lead Assigned</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Click below to get your next lead.
            </p>
            <Button className="mt-4 gap-2" onClick={fetchNext}>
              <ArrowRight className="h-4 w-4" /> Get Next Lead
            </Button>
          </div>
        </div>

        <Dialog open={showCompletionDialog} onOpenChange={setShowCompletionDialog}>
          <DialogContent className="text-center">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-center gap-2 text-xl">
                <PartyPopper className="h-6 w-6 text-score-high" /> Great Job!
              </DialogTitle>
              <DialogDescription className="text-base pt-2">
                Today's work is done. All leads in your assigned campaigns have been
                completed! 🎉
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="sm:justify-center">
              <Button onClick={() => setShowCompletionDialog(false)}>Awesome!</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // ─── Response color map ───────────────────────────────────────────────────
  const responseColors: Partial<Record<CallResponse, string>> = {
    Interested: 'bg-score-high text-primary-foreground hover:bg-score-high/90',
    'Not Interested': 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    'Follow Up': 'bg-score-medium text-primary-foreground hover:bg-score-medium/90',
  };

  const isDisposing = submitting || recorder.state === 'uploading';

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-slide-in">
      <div className="text-center">
        <h1 className="text-xl font-bold tracking-tight">Call Queue</h1>
        <p className="text-sm text-muted-foreground">
          Current lead — stays until you dispose
        </p>
      </div>

      {/* Lead Info */}
      <Card>
        <CardContent className="pt-6">
          <LeadDetailCard lead={lead} />
          <div className="mt-3">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground"
              asChild
            >
              <Link to={`/leads/${lead.id}`}>
                <ExternalLink className="h-3.5 w-3.5" /> View full detail
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Actions Card */}
      <Card>
        <CardContent className="pt-6 space-y-4">

          {/* ── START CALL BUTTON ─────────────────────────── */}
          {!callStarted ? (
            <Button
              className="w-full gap-2 min-h-[52px] text-base"
              onClick={handleStartCall}
              disabled={isDisposing}
            >
              <PhoneCall className="h-5 w-5" />
              {lead.phone_number
                ? `Start Call — ${lead.phone_number}`
                : 'Start Call'}
            </Button>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900 px-4 py-3">
              <span className="flex h-2.5 w-2.5 rounded-full bg-green-500">
                <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-green-400 opacity-75" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-green-800 dark:text-green-300">
                  Call in progress
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">
                  {lead.phone_number}
                </p>
              </div>
              {/* Allow re-dialing */}
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-green-700 dark:text-green-400 hover:bg-green-100"
                onClick={() => lead.phone_number && window.open(`tel:${lead.phone_number}`)}
              >
                <Phone className="h-3.5 w-3.5" /> Redial
              </Button>
            </div>
          )}

          {/* ── NOTES ────────────────────────────────────────── */}
          <Button
            variant="outline"
            className="w-full gap-2 min-h-[44px]"
            onClick={() => setShowNotes(!showNotes)}
          >
            <MessageSquare className="h-4 w-4" />
            {showNotes ? 'Hide Notes' : 'Add Notes'}
          </Button>

          {showNotes && (
            <Textarea
              placeholder="Add notes about this call..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          )}

          {/* ── FOLLOW-UP DATE PICKER (when Interested / Follow Up chosen) ── */}
          {pendingResponse && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
              <p className="text-sm font-medium">
                Set a follow-up date for "{pendingResponse}"? (optional)
              </p>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      'w-full justify-start gap-2 min-h-[44px]',
                      !followUpDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarClock className="h-4 w-4" />
                    {followUpDate ? format(followUpDate, 'PPP') : 'Pick a follow-up date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center">
                  <Calendar
                    mode="single"
                    selected={followUpDate}
                    onSelect={setFollowUpDate}
                    disabled={(date) =>
                      date < new Date(new Date().setHours(0, 0, 0, 0))
                    }
                    initialFocus
                    className={cn('p-3 pointer-events-auto')}
                  />
                </PopoverContent>
              </Popover>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 min-h-[44px]"
                  disabled={isDisposing || !callStarted}
                  onClick={() => submitResponse(pendingResponse)}
                >
                  {isDisposing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {recorder.uploadProgress || 'Saving...'}
                    </>
                  ) : (
                    `Confirm ${pendingResponse}`
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-[44px]"
                  onClick={() => {
                    setPendingResponse(null);
                    setFollowUpDate(undefined);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* ── DISPOSITION BUTTONS ─────────────────────────── */}
          {!pendingResponse && (
            <TooltipProvider delayDuration={200}>
              {!callStarted && (
                <div className="flex items-center gap-2 rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  Start the call first to enable disposition
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                {CALL_RESPONSES.filter((r) => r !== 'Skip').map((response) => {
                  const isLocked = !callStarted;
                  const btn = (
                    <Button
                      key={response}
                      variant="outline"
                      size="sm"
                      disabled={isDisposing || isLocked}
                      onClick={() => handleResponse(response)}
                      className={cn(
                        'min-h-[44px] w-full',
                        responseColors[response] ?? '',
                        isLocked && 'opacity-50 cursor-not-allowed',
                        isDisposing && 'opacity-70'
                      )}
                    >
                      {isDisposing && pendingResponse === response ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                          {recorder.uploadProgress || 'Saving...'}
                        </>
                      ) : (
                        response
                      )}
                    </Button>
                  );
                  return isLocked ? (
                    <Tooltip key={response}>
                      <TooltipTrigger asChild>
                        <span className="cursor-not-allowed">{btn}</span>
                      </TooltipTrigger>
                      <TooltipContent>Start the call first</TooltipContent>
                    </Tooltip>
                  ) : (
                    btn
                  );
                })}
              </div>

              {callStarted ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full gap-2 text-muted-foreground"
                  disabled={isDisposing}
                  onClick={() => handleResponse('Skip')}
                >
                  {isDisposing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <SkipForward className="h-4 w-4" />
                  )}
                  Skip this lead
                </Button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="block cursor-not-allowed">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full gap-2 text-muted-foreground opacity-50 pointer-events-none"
                        disabled
                      >
                        <SkipForward className="h-4 w-4" /> Skip this lead
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Start the call first</TooltipContent>
                </Tooltip>
              )}
            </TooltipProvider>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
