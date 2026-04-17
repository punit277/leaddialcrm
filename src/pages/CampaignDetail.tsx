import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ArrowLeft, Users, FileText, UserPlus, Trash2, Package, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface Agent {
  id: string;
  full_name: string | null;
}

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<any>(null);
  const [assignedAgents, setAssignedAgents] = useState<(Agent & { assignmentId: string })[]>([]);
  const [allAgents, setAllAgents] = useState<Agent[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, completed: 0, follow_up: 0 });
  const [loading, setLoading] = useState(true);
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fetchAll = async () => {
    if (!id) return;
    setLoading(true);

    const [campRes, assignRes, agentsRes, statsRes, batchRes] = await Promise.all([
      supabase.from('campaigns').select('*').eq('id', id).single(),
      supabase.from('campaign_assignments').select('*').eq('campaign_id', id),
      supabase.from('profiles').select('id, full_name'),
      supabase.from('leads').select('lead_status').eq('campaign_id', id),
      supabase.from('import_batches').select('id, filename, imported_rows').eq('status', 'completed'),
    ]);

    if (campRes.data) setCampaign(campRes.data);

    if (agentsRes.data && assignRes.data) {
      const assigned = assignRes.data.map((a: any) => {
        const profile = agentsRes.data.find((p: any) => p.id === a.agent_id);
        return { id: a.agent_id, full_name: profile?.full_name ?? 'Unknown', assignmentId: a.id };
      });
      setAssignedAgents(assigned);
      setAllAgents(agentsRes.data);
    }

    if (statsRes.data) {
      const s = { total: statsRes.data.length, pending: 0, completed: 0, follow_up: 0 };
      statsRes.data.forEach((l: any) => {
        if (l.lead_status === 'pending' || l.lead_status === 'assigned') s.pending++;
        else if (l.lead_status === 'completed') s.completed++;
        else if (l.lead_status === 'follow_up') s.follow_up++;
      });
      setStats(s);
    }

    if (batchRes.data) setBatches(batchRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [id]);

  const assignAgent = async () => {
    if (!selectedAgent || !id) return;
    setAssigning(true);
    const { error } = await supabase.from('campaign_assignments').insert({
      campaign_id: id,
      agent_id: selectedAgent,
    });
    if (error) {
      toast.error(error.message.includes('duplicate') ? 'Agent already assigned' : 'Failed to assign agent');
    } else {
      toast.success('Agent assigned');
      setAgentDialogOpen(false);
      setSelectedAgent('');
      fetchAll();
    }
    setAssigning(false);
  };

  const removeAgent = async (assignmentId: string) => {
    await supabase.from('campaign_assignments').delete().eq('id', assignmentId);
    toast.success('Agent removed');
    fetchAll();
  };

  const assignBatchLeads = async () => {
    if (!selectedBatch || !id) return;
    setAssigning(true);
    const { error } = await supabase.from('leads').update({ campaign_id: id }).eq('import_batch_id', selectedBatch);
    if (error) {
      toast.error('Failed to assign leads');
    } else {
      toast.success('Leads assigned to campaign');
      setBatchDialogOpen(false);
      setSelectedBatch('');
      fetchAll();
    }
    setAssigning(false);
  };

  const updateStatus = async (newStatus: string) => {
    if (!id) return;
    setStatusUpdating(true);
    await supabase.from('campaigns').update({ status: newStatus }).eq('id', id);
    setCampaign((prev: any) => ({ ...prev, status: newStatus }));
    toast.success(`Campaign ${newStatus}`);
    setStatusUpdating(false);
  };

  const deleteCampaign = async () => {
    if (!id) return;
    setDeleting(true);
    // Unlink leads
    await supabase.from('leads').update({ campaign_id: null }).eq('campaign_id', id);
    // Remove assignments
    await supabase.from('campaign_assignments').delete().eq('campaign_id', id);
    // Delete campaign
    const { error } = await supabase.from('campaigns').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete campaign');
      setDeleting(false);
    } else {
      toast.success('Campaign deleted');
      navigate('/campaigns');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!campaign) {
    return <p className="text-center text-muted-foreground py-16">Campaign not found</p>;
  }

  const statusColors: Record<string, string> = {
    active: 'bg-score-high/15 text-score-high',
    paused: 'bg-score-medium/15 text-score-medium',
    completed: 'bg-muted text-muted-foreground',
  };

  const unassignedAgents = allAgents.filter(a => !assignedAgents.some(aa => aa.id === a.id));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/campaigns')} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">{campaign.name}</h1>
              <Badge className={statusColors[campaign.status] ?? ''} variant="secondary">{campaign.status}</Badge>
            </div>
            {campaign.description && <p className="text-sm text-muted-foreground mt-1">{campaign.description}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {campaign.status === 'active' && (
            <Button variant="outline" size="sm" className="min-h-[44px]" onClick={() => updateStatus('paused')} disabled={statusUpdating}>Pause</Button>
          )}
          {campaign.status === 'paused' && (
            <Button variant="outline" size="sm" className="min-h-[44px]" onClick={() => updateStatus('active')} disabled={statusUpdating}>Resume</Button>
          )}
          {campaign.status !== 'completed' && (
            <Button variant="outline" size="sm" className="min-h-[44px]" onClick={() => updateStatus('completed')} disabled={statusUpdating}>Complete</Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="gap-1 min-h-[44px]" disabled={deleting}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-[calc(100vw-2rem)]">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete "{campaign.name}", remove all agent assignments, and unlink all leads from this campaign. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={deleteCampaign} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  {deleting ? 'Deleting...' : 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: 'Total Leads', value: stats.total, icon: FileText },
          { label: 'Pending', value: stats.pending, icon: FileText },
          { label: 'Completed', value: stats.completed, icon: FileText },
          { label: 'Follow Up', value: stats.follow_up, icon: FileText },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Agents */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Assigned Agents</CardTitle>
          <Dialog open={agentDialogOpen} onOpenChange={setAgentDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1"><UserPlus className="h-3.5 w-3.5" /> Add Agent</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Assign Agent</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                  <SelectTrigger><SelectValue placeholder="Select an agent" /></SelectTrigger>
                  <SelectContent>
                    {unassignedAgents.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.full_name || a.id.slice(0, 8)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button className="w-full" onClick={assignAgent} disabled={!selectedAgent || assigning}>
                  {assigning ? 'Assigning...' : 'Assign'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {assignedAgents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No agents assigned yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignedAgents.map(a => (
                  <TableRow key={a.assignmentId}>
                    <TableCell className="font-medium">{a.full_name}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => removeAgent(a.assignmentId)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Assign Leads from Batch */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" /> Assign Leads</CardTitle>
          <Dialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1"><Plus className="h-3.5 w-3.5" /> From Import Batch</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Assign Import Batch to Campaign</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <Select value={selectedBatch} onValueChange={setSelectedBatch}>
                  <SelectTrigger><SelectValue placeholder="Select a batch" /></SelectTrigger>
                  <SelectContent>
                    {batches.map(b => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.filename || b.id.slice(0, 8)} ({b.imported_rows} leads)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button className="w-full" onClick={assignBatchLeads} disabled={!selectedBatch || assigning}>
                  {assigning ? 'Assigning...' : 'Assign Leads'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {stats.total > 0 ? `${stats.total} leads currently in this campaign` : 'No leads assigned yet. Use "From Import Batch" to add leads.'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

