import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Megaphone, Plus, Users, FileText, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
  leadCount?: number;
  agentCount?: number;
}

const statusColors: Record<string, string> = {
  active: 'bg-score-high/15 text-score-high',
  paused: 'bg-score-medium/15 text-score-medium',
  completed: 'bg-muted text-muted-foreground',
};

export default function Campaigns() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchCampaigns = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      // Get counts
      const enriched = await Promise.all(
        data.map(async (c: any) => {
          const [leads, agents] = await Promise.all([
            supabase.from('leads').select('id', { count: 'exact', head: true }).eq('campaign_id', c.id),
            supabase.from('campaign_assignments').select('id', { count: 'exact', head: true }).eq('campaign_id', c.id),
          ]);
          return { ...c, leadCount: leads.count ?? 0, agentCount: agents.count ?? 0 };
        })
      );
      setCampaigns(enriched);
    }
    setLoading(false);
  };

  useEffect(() => { fetchCampaigns(); }, []);

  const createCampaign = async () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    setCreating(true);
    const { error } = await supabase.from('campaigns').insert({
      name: name.trim(),
      description: description.trim() || null,
      created_by: user!.id,
    });
    if (error) {
      toast.error('Failed to create campaign');
    } else {
      toast.success('Campaign created');
      setName('');
      setDescription('');
      setDialogOpen(false);
      fetchCampaigns();
    }
    setCreating(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-sm text-muted-foreground">Group leads and assign agents to campaigns</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> New Campaign</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Campaign</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <Input placeholder="Campaign name" value={name} onChange={e => setName(e.target.value)} />
              <Textarea placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} rows={3} />
              <Button className="w-full" onClick={createCampaign} disabled={creating}>
                {creating ? 'Creating...' : 'Create Campaign'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Megaphone className="mb-4 h-12 w-12 text-muted-foreground/30" />
            <h3 className="text-lg font-semibold">No campaigns yet</h3>
            <p className="text-sm text-muted-foreground">Create your first campaign to organize leads</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.map(c => (
            <Link key={c.id} to={`/campaigns/${c.id}`}>
              <Card className="transition-shadow hover:shadow-md cursor-pointer">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-base leading-tight">{c.name}</h3>
                    <Badge className={statusColors[c.status] ?? statusColors.active} variant="secondary">
                      {c.status}
                    </Badge>
                  </div>
                  {c.description && (
                    <p className="text-xs text-muted-foreground mb-4 line-clamp-2">{c.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> {c.leadCount} leads</span>
                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {c.agentCount} agents</span>
                  </div>
                  <div className="mt-3 flex items-center gap-1 text-xs text-primary font-medium">
                    View Details <ChevronRight className="h-3 w-3" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
