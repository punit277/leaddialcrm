import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';

export default function AgentHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<any[]>([]);
  const [reopening, setReopening] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from('call_logs')
      .select('*, leads:lead_id(business_name, category, lead_status)')
      .eq('agent_id', user.id)
      .order('called_at', { ascending: false })
      .limit(100)
      .then(({ data }) => setLogs(data ?? []));
  }, [user]);

  const handleReopen = useCallback(async (log: any) => {
    if (!user || reopening) return;
    const leadId = log.lead_id;
    const leadStatus = (log.leads as any)?.lead_status;

    // Don't reopen leads already in active/pending state
    if (leadStatus === 'assigned' || leadStatus === 'pending') {
      toast.info('This lead is already in the active queue.');
      return;
    }

    setReopening(leadId);
    try {
      // Check if agent has an active lead
      const { data: activeLead } = await supabase
        .from('leads')
        .select('id')
        .eq('assigned_to', user.id)
        .eq('lead_status', 'assigned')
        .limit(1)
        .maybeSingle();

      if (activeLead) {
        toast.warning('You must dispose your current lead before reopening another.');
        return;
      }

      // Atomically claim the lead
      const { data: updated, error } = await supabase
        .from('leads')
        .update({
          lead_status: 'assigned',
          assigned_to: user.id,
          assigned_at: new Date().toISOString(),
          call_response: null,
        })
        .eq('id', leadId)
        .select('id')
        .maybeSingle();

      if (error || !updated) {
        toast.error('Failed to reopen lead. It may have been reassigned.');
        return;
      }

      toast.success('Lead reopened — loading on your dashboard.');
      navigate('/agent/queue');
    } finally {
      setReopening(null);
    }
  }, [user, reopening, navigate]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Call History</h1>
        <p className="text-sm text-muted-foreground">{logs.length} calls</p>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business</TableHead>
                <TableHead>Response</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Time</TableHead>
                <TableHead className="w-12">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground">No calls yet</TableCell></TableRow>
              ) : logs.map(log => {
                const leadStatus = (log.leads as any)?.lead_status;
                const isActive = leadStatus === 'assigned' || leadStatus === 'pending';
                const isLoading = reopening === log.lead_id;

                return (
                  <TableRow key={log.id}>
                    <TableCell>
                      <p className="font-medium text-sm">{(log.leads as any)?.business_name ?? '—'}</p>
                    </TableCell>
                    <TableCell className="text-sm font-medium">{log.response}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{log.notes || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(new Date(log.called_at), 'MMM d, HH:mm')}</TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={isActive || isLoading}
                              onClick={() => handleReopen(log)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {isActive ? 'Lead already in queue' : 'Reopen this lead'}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
