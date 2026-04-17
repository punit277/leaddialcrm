import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Headphones } from 'lucide-react';

interface AgentStat {
  id: string;
  full_name: string;
  is_active: boolean;
  calls_today: number;
  interested_count: number;
  assigned_lead: string | null;
}

export default function AgentMonitor() {
  const [agents, setAgents] = useState<AgentStat[]>([]);

  useEffect(() => {
    const fetch = async () => {
      // Get all agents
      const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'agent');
      if (!roles?.length) return;

      const agentIds = roles.map(r => r.user_id);
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, is_active').in('id', agentIds);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const stats: AgentStat[] = await Promise.all(
        (profiles ?? []).map(async (p) => {
          const [callsRes, interestedRes, assignedRes] = await Promise.all([
            supabase.from('call_logs').select('id', { count: 'exact', head: true }).eq('agent_id', p.id).gte('called_at', today.toISOString()),
            supabase.from('call_logs').select('id', { count: 'exact', head: true }).eq('agent_id', p.id).eq('response', 'Interested'),
            supabase.from('leads').select('business_name').eq('assigned_to', p.id).eq('lead_status', 'assigned').maybeSingle(),
          ]);
          return {
            id: p.id,
            full_name: p.full_name ?? 'Unknown',
            is_active: p.is_active ?? true,
            calls_today: callsRes.count ?? 0,
            interested_count: interestedRes.count ?? 0,
            assigned_lead: assignedRes.data?.business_name ?? null,
          };
        })
      );
      setAgents(stats);
    };
    fetch();
    const interval = setInterval(fetch, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Agent Monitor</h1>
        <p className="text-sm text-muted-foreground">{agents.length} agents registered</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map(agent => (
          <Card key={agent.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Headphones className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{agent.full_name}</p>
                    <Badge variant={agent.assigned_lead ? 'default' : 'secondary'} className="text-[10px]">
                      {agent.assigned_lead ? 'Calling' : 'Idle'}
                    </Badge>
                  </div>
                </div>
              </div>
              {agent.assigned_lead && (
                <p className="mb-3 text-xs text-muted-foreground">
                  Current: <span className="font-medium text-foreground">{agent.assigned_lead}</span>
                </p>
              )}
              <div className="flex gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Calls Today</p>
                  <p className="text-lg font-bold">{agent.calls_today}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Interested</p>
                  <p className="text-lg font-bold text-score-high">{agent.interested_count}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {agents.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="py-16 text-center text-muted-foreground">
              No agents registered yet
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
