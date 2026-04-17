import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, PhoneCall, TrendingUp, Clock, CheckCircle, XCircle } from 'lucide-react';

interface Stats {
  totalLeads: number;
  pendingQueue: number;
  calledToday: number;
  interested: number;
  completed: number;
  followUp: number;
}

interface AgentCallStat {
  agentId: string;
  agentName: string;
  totalCalls: number;
  callsToday: number;
}

interface CampaignCallStat {
  campaignName: string;
  totalCalls: number;
}

interface LastContactInfo {
  leadId: string;
  businessName: string;
  agentName: string;
  contactTime: string;
}

export default function Dashboard() {
  const { role } = useAuth();
  const [stats, setStats] = useState<Stats>({ totalLeads: 0, pendingQueue: 0, calledToday: 0, interested: 0, completed: 0, followUp: 0 });
  const [responseCounts, setResponseCounts] = useState<Record<string, number>>({});
  const [agentStats, setAgentStats] = useState<AgentCallStat[]>([]);
  const [campaignStats, setCampaignStats] = useState<CampaignCallStat[]>([]);
  const [lastContacts, setLastContacts] = useState<LastContactInfo[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      const [totalRes, pendingRes, interestedRes, completedRes, followUpRes] = await Promise.all([
        supabase.from('leads').select('id', { count: 'exact', head: true }),
        supabase.from('leads').select('id', { count: 'exact', head: true }).in('lead_status', ['pending', 'follow_up']),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('call_response', 'Interested'),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('lead_status', 'completed'),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('lead_status', 'follow_up'),
      ]);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const calledTodayRes = await supabase.from('call_logs').select('id', { count: 'exact', head: true }).gte('called_at', today.toISOString());

      setStats({
        totalLeads: totalRes.count ?? 0,
        pendingQueue: pendingRes.count ?? 0,
        calledToday: calledTodayRes.count ?? 0,
        interested: interestedRes.count ?? 0,
        completed: completedRes.count ?? 0,
        followUp: followUpRes.count ?? 0,
      });

      const { data: logs } = await supabase.from('call_logs').select('response');
      if (logs) {
        const counts: Record<string, number> = {};
        logs.forEach(l => { counts[l.response] = (counts[l.response] || 0) + 1; });
        setResponseCounts(counts);
      }
    };
    fetchStats();
  }, []);

  // Admin-only: agent call tracking + last contacted info
  useEffect(() => {
    if (role !== 'admin') return;

    const fetchAgentStats = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      const [{ data: allLogs }, { data: profiles }] = await Promise.all([
        supabase.from('call_logs').select('agent_id, called_at, lead_id').order('called_at', { ascending: false }),
        supabase.from('profiles').select('id, full_name'),
      ]);

      if (!allLogs || !profiles) return;

      const profileMap = new Map(profiles.map(p => [p.id, p.full_name || 'Unknown']));

      // Per-agent stats
      const agentMap = new Map<string, { total: number; today: number }>();
      allLogs.forEach(log => {
        const entry = agentMap.get(log.agent_id) || { total: 0, today: 0 };
        entry.total++;
        if (log.called_at >= todayISO) entry.today++;
        agentMap.set(log.agent_id, entry);
      });

      setAgentStats(
        Array.from(agentMap.entries())
          .map(([agentId, s]) => ({
            agentId,
            agentName: profileMap.get(agentId) || 'Unknown',
            totalCalls: s.total,
            callsToday: s.today,
          }))
          .sort((a, b) => b.totalCalls - a.totalCalls)
      );

      // Last contacted per lead (most recent call log per lead)
      const lastContactMap = new Map<string, { agent_id: string; called_at: string }>();
      allLogs.forEach(log => {
        if (!lastContactMap.has(log.lead_id)) {
          lastContactMap.set(log.lead_id, { agent_id: log.agent_id, called_at: log.called_at });
        }
      });

      // Get lead names for last 20 contacted leads
      const recentLeadIds = Array.from(lastContactMap.keys()).slice(0, 20);
      if (recentLeadIds.length > 0) {
        const { data: leads } = await supabase.from('leads').select('id, business_name, campaign_id').in('id', recentLeadIds);
        const leadMap = new Map(leads?.map(l => [l.id, l]) || []);

        setLastContacts(
          recentLeadIds
            .map(leadId => {
              const contact = lastContactMap.get(leadId)!;
              const lead = leadMap.get(leadId);
              return {
                leadId,
                businessName: lead?.business_name || 'Unknown',
                agentName: profileMap.get(contact.agent_id) || 'Unknown',
                contactTime: contact.called_at,
              };
            })
        );

        // Campaign stats
        const campaignIds = [...new Set(leads?.map(l => l.campaign_id).filter(Boolean) || [])];
        if (campaignIds.length > 0) {
          const { data: campaigns } = await supabase.from('campaigns').select('id, name').in('id', campaignIds as string[]);
          const campNameMap = new Map(campaigns?.map(c => [c.id, c.name]) || []);

          const campCounts = new Map<string, number>();
          allLogs.forEach(log => {
            const lead = leadMap.get(log.lead_id);
            if (lead?.campaign_id) {
              campCounts.set(lead.campaign_id, (campCounts.get(lead.campaign_id) || 0) + 1);
            }
          });

          // For leads not in the initial batch, we need a broader lookup
          const missingLeadIds = allLogs
            .map(l => l.lead_id)
            .filter(id => !leadMap.has(id));
          
          if (missingLeadIds.length > 0) {
            const uniqueMissing = [...new Set(missingLeadIds)];
            for (let i = 0; i < uniqueMissing.length; i += 500) {
              const chunk = uniqueMissing.slice(i, i + 500);
              const { data: moreLeads } = await supabase.from('leads').select('id, campaign_id').in('id', chunk);
              moreLeads?.forEach(l => {
                if (l.campaign_id) {
                  // Count logs for this lead
                  const logsForLead = allLogs.filter(log => log.lead_id === l.id).length;
                  campCounts.set(l.campaign_id, (campCounts.get(l.campaign_id) || 0) + logsForLead);
                  if (!campNameMap.has(l.campaign_id)) {
                    // Will need name lookup
                  }
                }
              });
            }

            // Get any missing campaign names
            const missingCampIds = [...campCounts.keys()].filter(id => !campNameMap.has(id));
            if (missingCampIds.length > 0) {
              const { data: moreCamps } = await supabase.from('campaigns').select('id, name').in('id', missingCampIds);
              moreCamps?.forEach(c => campNameMap.set(c.id, c.name));
            }
          }

          setCampaignStats(
            Array.from(campCounts.entries())
              .map(([id, count]) => ({ campaignName: campNameMap.get(id) || 'Unknown', totalCalls: count }))
              .sort((a, b) => b.totalCalls - a.totalCalls)
          );
        }
      }
    };

    fetchAgentStats();
  }, [role]);

  const statCards = [
    { label: 'Total Leads', value: stats.totalLeads, icon: Users, color: 'text-primary' },
    { label: 'Pending Queue', value: stats.pendingQueue, icon: Clock, color: 'text-score-medium' },
    { label: 'Called Today', value: stats.calledToday, icon: PhoneCall, color: 'text-score-high' },
    { label: 'Interested', value: stats.interested, icon: TrendingUp, color: 'text-score-high' },
    { label: 'Completed', value: stats.completed, icon: CheckCircle, color: 'text-primary' },
    { label: 'Follow Ups', value: stats.followUp, icon: XCircle, color: 'text-score-medium' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of your lead calling operations</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map(card => (
          <Card key={card.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{card.value.toLocaleString()}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {Object.keys(responseCounts).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Call Response Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(responseCounts).sort((a, b) => b[1] - a[1]).map(([response, count]) => (
                <div key={response} className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm font-medium">{response}</span>
                  <span className="text-lg font-bold">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Admin-only: Agent Call Activity */}
      {role === 'admin' && agentStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agent Call Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead className="text-right">Today</TableHead>
                  <TableHead className="text-right">Total Calls</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agentStats.map(a => (
                  <TableRow key={a.agentId}>
                    <TableCell className="font-medium">{a.agentName}</TableCell>
                    <TableCell className="text-right">{a.callsToday}</TableCell>
                    <TableCell className="text-right">{a.totalCalls}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {role === 'admin' && campaignStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Calls per Campaign</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead className="text-right">Total Calls</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaignStats.map(c => (
                  <TableRow key={c.campaignName}>
                    <TableCell className="font-medium">{c.campaignName}</TableCell>
                    <TableCell className="text-right">{c.totalCalls}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Admin-only: Last Contacted Agent per Lead */}
      {role === 'admin' && lastContacts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Last Contacted By (Recent Leads)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Last Agent</TableHead>
                  <TableHead>Last Contact</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lastContacts.map(c => (
                  <TableRow key={c.leadId}>
                    <TableCell className="font-medium">{c.businessName}</TableCell>
                    <TableCell>{c.agentName}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(c.contactTime).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
