import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { CALL_RESPONSES } from '@/lib/constants';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

const PAGE_SIZE = 25;

export default function CallLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [responseFilter, setResponseFilter] = useState('all');

  useEffect(() => {
    const fetch = async () => {
      let query = supabase.from('call_logs').select(`
        *,
        leads:lead_id(business_name, category),
        profiles:agent_id(full_name)
      `, { count: 'exact' });
      if (responseFilter !== 'all') query = query.eq('response', responseFilter);
      query = query.order('called_at', { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      const { data, count: total } = await query;
      setLogs(data ?? []);
      setCount(total ?? 0);
    };
    fetch();
  }, [page, responseFilter]);

  const totalPages = Math.ceil(count / PAGE_SIZE);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Call Logs</h1>
          <p className="text-sm text-muted-foreground">{count} total entries</p>
        </div>
        <Select value={responseFilter} onValueChange={v => { setResponseFilter(v); setPage(0); }}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Filter" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Responses</SelectItem>
            {CALL_RESPONSES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business</TableHead>
                <TableHead className="hidden sm:table-cell">Agent</TableHead>
                <TableHead>Response</TableHead>
                <TableHead className="hidden md:table-cell">Notes</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground">No call logs yet</TableCell></TableRow>
              ) : logs.map(log => (
                <TableRow key={log.id}>
                  <TableCell>
                    <p className="font-medium text-sm">{(log.leads as any)?.business_name ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">{(log.leads as any)?.category ?? ''}</p>
                  </TableCell>
                  <TableCell className="text-sm hidden sm:table-cell">{(log.profiles as any)?.full_name ?? '—'}</TableCell>
                  <TableCell className="text-sm font-medium">{log.response}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate hidden md:table-cell">{log.notes || '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{format(new Date(log.called_at), 'MMM d, HH:mm')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t p-4">
              <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
