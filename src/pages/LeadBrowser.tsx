import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScoreBadge } from '@/components/ScoreBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { LeadDetailCard } from '@/components/LeadDetailCard';
import { LEAD_STATUSES } from '@/lib/constants';
import { Search, ChevronLeft, ChevronRight, Star, ExternalLink, Globe, MapPin, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

function verifyUrl(lead: any) {
  const q = encodeURIComponent(`${lead.business_name || ''} ${lead.address_full || lead.address_line1 || ''}`);
  return { google: `https://www.google.com/search?q=${q}`, maps: `https://www.google.com/maps/search/${q}` };
}

const PAGE_SIZE = 25;

export default function LeadBrowser() {
  const [leads, setLeads] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [scoreFilter, setScoreFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const { role } = useAuth();
  const navigate = useNavigate();

  const fetchLeads = async () => {
    setLoading(true);
    let query = supabase.from('leads').select('*', { count: 'exact' });
    if (search) query = query.ilike('business_name', `%${search}%`);
    if (statusFilter !== 'all') query = query.eq('lead_status', statusFilter);
    if (scoreFilter !== 'all') query = query.eq('lead_score', parseInt(scoreFilter));
    query = query.order('created_at', { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    const { data, count: total } = await query;
    setLeads(data ?? []);
    setCount(total ?? 0);
    setLoading(false);
  };

  useEffect(() => { fetchLeads(); }, [page, statusFilter, scoreFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchLeads();
  };

  const handleReopen = async (leadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from('leads').update({
      lead_status: 'pending',
      assigned_to: null,
      assigned_at: null,
      call_response: null,
    }).eq('id', leadId);
    toast.success('Lead reopened');
    fetchLeads();
  };

  const totalPages = Math.ceil(count / PAGE_SIZE);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Lead Browser</h1>
        <p className="text-sm text-muted-foreground">{count.toLocaleString()} leads total</p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3">
            <form onSubmit={handleSearch} className="flex flex-1 gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search business name..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Button type="submit" variant="secondary" className="min-h-[44px]">Search</Button>
            </form>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
                <SelectTrigger className="flex-1 min-w-0"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {LEAD_STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={scoreFilter} onValueChange={v => { setScoreFilter(v); setPage(0); }}>
                <SelectTrigger className="flex-1 min-w-0"><SelectValue placeholder="Score" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Scores</SelectItem>
                  <SelectItem value="2">High</SelectItem>
                  <SelectItem value="1">Medium</SelectItem>
                  <SelectItem value="0">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead className="hidden md:table-cell">Category</TableHead>
                  <TableHead className="hidden sm:table-cell">Rating</TableHead>
                  <TableHead className="hidden lg:table-cell">Reviews</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Response</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="h-32 text-center text-muted-foreground">Loading...</TableCell></TableRow>
                ) : leads.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="h-32 text-center text-muted-foreground">No leads found</TableCell></TableRow>
                ) : leads.map(lead => {
                  const canReopen = ['completed', 'skipped', 'do_not_call'].includes(lead.lead_status);
                  return (
                    <TableRow key={lead.id} className="cursor-pointer hover:bg-accent/50" onClick={() => setSelectedLead(lead)}>
                      <TableCell>
                        <div className="max-w-[200px]">
                          <p className="font-medium truncate">{lead.business_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{lead.address_full || lead.address_line1 || '—'}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm hidden md:table-cell">{lead.category || '—'}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {lead.rating ? (
                          <span className="flex items-center gap-1 text-sm">
                            <Star className="h-3 w-3 fill-score-medium text-score-medium" />
                            {lead.rating}
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-sm hidden lg:table-cell">{lead.reviews_count?.toLocaleString() ?? '—'}</TableCell>
                      <TableCell><ScoreBadge score={lead.lead_score} /></TableCell>
                      <TableCell><StatusBadge status={lead.lead_status} /></TableCell>
                      <TableCell className="text-sm hidden md:table-cell">{lead.call_response || '—'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="Google Search">
                            <a href={verifyUrl(lead).google} target="_blank" rel="noopener noreferrer"><Globe className="h-3.5 w-3.5" /></a>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="Google Maps">
                            <a href={verifyUrl(lead).maps} target="_blank" rel="noopener noreferrer"><MapPin className="h-3.5 w-3.5" /></a>
                          </Button>
                          {canReopen && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Reopen Lead"
                              onClick={(e) => handleReopen(lead.id, e)}>
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t p-4">
              <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!selectedLead} onOpenChange={open => { if (!open) setSelectedLead(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Lead Details</SheetTitle>
          </SheetHeader>
          {selectedLead && (
            <div className="mt-4 space-y-4">
              <LeadDetailCard lead={selectedLead} />
              <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => navigate(`/leads/${selectedLead.id}`)}>
                <ExternalLink className="h-4 w-4" /> View Full Detail Page
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
