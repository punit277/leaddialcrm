import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Trash2, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ImportBatch {
  id: string;
  filename: string | null;
  status: string;
  total_rows: number | null;
  imported_rows: number | null;
  failed_rows: number | null;
  created_at: string;
  completed_at: string | null;
}

export default function DeleteLeads() {
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchBatches = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('import_batches')
      .select('id, filename, status, total_rows, imported_rows, failed_rows, created_at, completed_at')
      .order('created_at', { ascending: false });
    setBatches(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchBatches(); }, []);

  const deleteBatch = async (batch: ImportBatch) => {
    setDeleting(batch.id);
    try {
      // Delete leads first (foreign key: leads.import_batch_id)
      // Also delete related call_logs and lead_assignments for those leads
      const { data: leadIds } = await supabase
        .from('leads')
        .select('id')
        .eq('import_batch_id', batch.id);

      if (leadIds && leadIds.length > 0) {
        const ids = leadIds.map(l => l.id);

        // Delete in chunks of 100 to avoid query size limits
        for (let i = 0; i < ids.length; i += 100) {
          const chunk = ids.slice(i, i + 100);
          await Promise.all([
            supabase.from('call_logs').delete().in('lead_id', chunk),
            supabase.from('lead_assignments').delete().in('lead_id', chunk),
          ]);
          await supabase.from('leads').delete().in('id', chunk);
        }
      }

      // Delete the batch record
      await supabase.from('import_batches').delete().eq('id', batch.id);

      toast.success(`Deleted ${batch.filename ?? 'batch'} and ${leadIds?.length ?? 0} leads`);
      fetchBatches();
    } catch (err) {
      toast.error('Failed to delete batch');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Delete Leads by Sheet</h1>
          <p className="text-sm text-muted-foreground">Remove all leads from an imported file</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchBatches} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import History</CardTitle>
          <CardDescription>Select a batch to delete all its leads, call logs, and assignments</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : batches.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileSpreadsheet className="mx-auto mb-3 h-10 w-10 opacity-30" />
              <p>No import batches found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Filename</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Rows</TableHead>
                    <TableHead>Imported</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-[80px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map(batch => (
                    <TableRow key={batch.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4 text-primary" />
                          {batch.filename ?? 'Unknown'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={batch.status === 'completed' ? 'default' : 'secondary'}>
                          {batch.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{batch.total_rows?.toLocaleString() ?? '-'}</TableCell>
                      <TableCell>{batch.imported_rows?.toLocaleString() ?? '-'}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(batch.created_at), 'dd MMM yyyy, HH:mm')}
                      </TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="icon"
                              disabled={deleting === batch.id}
                            >
                              {deleting === batch.id ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-destructive-foreground border-t-transparent" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete entire import?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete <strong>{batch.imported_rows ?? batch.total_rows ?? 0}</strong> leads
                                from <strong>{batch.filename ?? 'this batch'}</strong>, along with all related call logs and assignments.
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteBatch(batch)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete All Leads
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
