import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, Check, AlertTriangle, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { CRM_FIELDS, computeLeadScore } from '@/lib/constants';
import * as XLSX from 'xlsx';
import { ColumnMappingTable } from '@/components/import/ColumnMappingTable';
import { CampaignDistribution } from '@/components/import/CampaignDistribution';

interface ColumnMapping {
  rawColumn: string;
  displayName: string;
  detectedField: string;
  confidence: number;
  samples: string[];
  isCustom?: boolean;
}

interface CampaignAllocation {
  campaignId: string;
  campaignName: string;
  count: number;
}

function autoDetectField(colName: string, values: string[]): { field: string; confidence: number } {
  const nonNull = values.filter(v => v != null && v !== '');
  if (nonNull.length === 0) return { field: 'ignore', confidence: 100 };

  const lowerCol = colName.toLowerCase().replace(/[_\-\s]+/g, '');

  const nameMap: Record<string, string> = {
    businessname: 'business_name', business: 'business_name', name: 'business_name', company: 'business_name',
    phone: 'phone_number', phonenumber: 'phone_number', mobile: 'phone_number', contact: 'phone_number',
    rating: 'rating', stars: 'rating', score: 'rating',
    reviews: 'reviews_count', reviewcount: 'reviews_count', reviewscount: 'reviews_count', totalreviews: 'reviews_count',
    category: 'category', type: 'category',
    address: 'address_full', location: 'address_full', addressfull: 'address_full', fulladdress: 'address_full',
    addressline1: 'address_line1', street: 'address_line1',
    mapslink: 'maps_link', googlemap: 'maps_link', googlemaps: 'maps_link', maplink: 'maps_link',
    website: 'website', url: 'website', web: 'website', site: 'website',
    instagram: 'instagram', ig: 'instagram', insta: 'instagram',
    facebook: 'facebook', fb: 'facebook',
    whatsapp: 'whatsapp', wa: 'whatsapp',
    description: 'description', desc: 'description', about: 'description',
    openstatus: 'open_status', status: 'open_status',
    hours: 'hours_detail', hoursdetail: 'hours_detail', timing: 'hours_detail',
    servicetype: 'service_type', service: 'service_type',
    photo: 'photo_url', image: 'photo_url', photourl: 'photo_url',
  };

  if (nameMap[lowerCol]) return { field: nameMap[lowerCol], confidence: 95 };

  if (nonNull.some(v => String(v).includes('instagram.com'))) return { field: 'instagram', confidence: 90 };
  if (nonNull.some(v => String(v).includes('facebook.com'))) return { field: 'facebook', confidence: 90 };
  if (nonNull.some(v => /wa\.me|whatsapp/i.test(String(v)))) return { field: 'whatsapp', confidence: 90 };
  if (nonNull.some(v => String(v).includes('google.com/maps'))) return { field: 'maps_link', confidence: 95 };
  if (nonNull.some(v => String(v).includes('googleusercontent.com'))) return { field: 'photo_url', confidence: 90 };
  if (nonNull.some(v => /^https?:\/\//.test(String(v))) && !nonNull.some(v => /google|instagram|facebook/i.test(String(v)))) {
    return { field: 'website', confidence: 75 };
  }

  const nums = nonNull.map(v => parseFloat(String(v))).filter(n => !isNaN(n));
  if (nums.length > nonNull.length * 0.7) {
    if (nums.every(n => n >= 0 && n <= 5) && nums.some(n => n > 0)) return { field: 'rating', confidence: 85 };
    if (nums.every(n => n >= 0)) return { field: 'reviews_count', confidence: 70 };
  }

  const joined = nonNull.join(' ').toLowerCase();
  if (/\b(open|closed|24 hours)\b/.test(joined) && nonNull.length < 50) return { field: 'open_status', confidence: 75 };
  if (/\b(closes|opens|am|pm)\b/.test(joined)) return { field: 'hours_detail', confidence: 70 };
  if (/\b(street|floor|road|marg|block|sector)\b/i.test(joined)) return { field: 'address_full', confidence: 65 };

  const avgLen = nonNull.reduce((sum, v) => sum + String(v).length, 0) / nonNull.length;
  if (avgLen > 15 && !nonNull.some(v => String(v).startsWith('http'))) return { field: 'business_name', confidence: 60 };

  return { field: 'description', confidence: 40 };
}

export default function ImportManager() {
  const { user } = useAuth();
  const [step, setStep] = useState<'upload' | 'mapping' | 'distribute' | 'importing' | 'done'>('upload');
  const [rawData, setRawData] = useState<Record<string, any>[]>([]);
  const [columns, setColumns] = useState<ColumnMapping[]>([]);
  const [filename, setFilename] = useState('');
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState({ imported: 0, failed: 0 });
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [allocations, setAllocations] = useState<CampaignAllocation[]>([]);
  const [editingCol, setEditingCol] = useState<number | null>(null);

  useEffect(() => {
    supabase.from('campaigns').select('id, name').eq('status', 'active').then(({ data }) => {
      if (data) setCampaigns(data);
    });
  }, []);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);

    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) {
      toast.error('File is empty');
      return;
    }

    setRawData(rows);
    const cols = Object.keys(rows[0]);
    const sampleSize = Math.min(50, rows.length);
    const mappings: ColumnMapping[] = cols.map(col => {
      const samples = rows.slice(0, sampleSize).map(r => String(r[col] ?? ''));
      const { field, confidence } = autoDetectField(col, samples);
      return { rawColumn: col, displayName: col, detectedField: field, confidence, samples: samples.slice(0, 3) };
    });

    setColumns(mappings);
    setStep('mapping');
    toast.success(`Loaded ${rows.length.toLocaleString()} rows from ${file.name}`);
  }, []);

  const updateMapping = (index: number, field: string) => {
    setColumns(prev => prev.map((c, i) => i === index ? { ...c, detectedField: field, confidence: 100, isCustom: field === 'custom' } : c));
  };

  const updateDisplayName = (index: number, name: string) => {
    setColumns(prev => prev.map((c, i) => i === index ? { ...c, displayName: name } : c));
  };

  const hasBizName = columns.some(c => c.detectedField === 'business_name');

  const goToDistribute = () => {
    if (!hasBizName) {
      toast.error('You must map at least one column to "business_name"');
      return;
    }
    // Initialize allocations from campaigns
    setAllocations(campaigns.map(c => ({ campaignId: c.id, campaignName: c.name, count: 0 })));
    setStep('distribute');
  };

  const updateAllocation = (campaignId: string, count: number) => {
    setAllocations(prev => prev.map(a => a.campaignId === campaignId ? { ...a, count: Math.max(0, count) } : a));
  };

  const totalAllocated = allocations.reduce((s, a) => s + a.count, 0);
  const unassigned = rawData.length - totalAllocated;

  const startImport = async () => {
    if (totalAllocated > rawData.length) {
      toast.error(`Total distributed (${totalAllocated}) exceeds rows (${rawData.length})`);
      return;
    }

    setStep('importing');
    const mapping: Record<string, string> = {};
    const customFields: string[] = [];
    columns.forEach(c => {
      if (c.detectedField === 'ignore') return;
      if (c.detectedField === 'custom') {
        customFields.push(c.rawColumn);
      } else {
        mapping[c.rawColumn] = c.detectedField;
      }
    });

    const { data: batch, error: batchErr } = await supabase.from('import_batches').insert({
      uploaded_by: user!.id,
      filename,
      status: 'processing',
      total_rows: rawData.length,
      column_mapping: mapping,
      detection_result: columns.map(c => ({ col: c.rawColumn, display: c.displayName, field: c.detectedField, confidence: c.confidence })),
    }).select().single();

    if (batchErr || !batch) {
      toast.error('Failed to create import batch');
      setStep('distribute');
      return;
    }

    // Build campaign assignment order: first N to campaign A, next M to campaign B, etc.
    const campaignOrder: (string | null)[] = [];
    allocations.forEach(a => {
      for (let i = 0; i < a.count; i++) campaignOrder.push(a.campaignId);
    });
    // Remaining get null
    while (campaignOrder.length < rawData.length) campaignOrder.push(null);

    let imported = 0;
    let failed = 0;
    const chunkSize = 500;

    for (let i = 0; i < rawData.length; i += chunkSize) {
      const chunk = rawData.slice(i, i + chunkSize);
      const leads = chunk.map((row, idx) => {
        const lead: Record<string, any> = { import_batch_id: batch.id, raw_data: row };
        const campaignId = campaignOrder[i + idx];
        if (campaignId) lead.campaign_id = campaignId;

        for (const [rawCol, crmField] of Object.entries(mapping)) {
          let val = row[rawCol];
          if (val === '' || val == null) continue;
          switch (crmField) {
            case 'reviews_count':
              lead[crmField] = Math.abs(parseInt(String(val), 10)) || null;
              break;
            case 'rating':
              const r = parseFloat(String(val));
              lead[crmField] = (r >= 0 && r <= 5) ? r : null;
              break;
            case 'business_name':
              lead[crmField] = String(val).replace(/\|.*$/, '').trim();
              break;
            case 'description':
              lead[crmField] = String(val).replace(/^["']|["']$/g, '').slice(0, 1000);
              break;
            default:
              lead[crmField] = String(val).trim();
          }
        }

        if (customFields.length > 0) {
          const customData: Record<string, any> = { ...(lead.raw_data || {}) };
          customFields.forEach(col => {
            if (row[col] != null && row[col] !== '') customData[col] = row[col];
          });
          lead.raw_data = customData;
        }

        if (!lead.business_name) return null;
        lead.lead_score = computeLeadScore(lead.rating ?? null, lead.reviews_count ?? null);
        return lead;
      }).filter(Boolean);

      const { error } = await supabase.from('leads').insert(leads as any[]);
      if (error) {
        failed += leads.length;
      } else {
        imported += leads.length;
      }
      setProgress(Math.round(((i + chunk.length) / rawData.length) * 100));
    }

    await supabase.from('import_batches').update({
      status: 'completed',
      imported_rows: imported,
      failed_rows: failed,
      completed_at: new Date().toISOString(),
    }).eq('id', batch.id);

    setImportResult({ imported, failed });
    setStep('done');
    toast.success(`Import complete: ${imported} leads imported`);
  };

  const allFields = [...CRM_FIELDS, 'custom' as const];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import Manager</h1>
        <p className="text-sm text-muted-foreground">Upload Excel or CSV files to import leads</p>
      </div>

      {step === 'upload' && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <h3 className="mb-1 text-lg font-semibold">Upload Lead Data</h3>
            <p className="mb-6 text-sm text-muted-foreground">Supports .xlsx and .csv files up to 50MB</p>
            <label className="cursor-pointer">
              <Button asChild><span>Choose File</span></Button>
              <input type="file" accept=".xlsx,.csv,.xls" onChange={handleFile} className="hidden" />
            </label>
          </CardContent>
        </Card>
      )}

      {step === 'mapping' && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">{filename}</CardTitle>
                <CardDescription>{rawData.length.toLocaleString()} rows detected · Map each column to a CRM field</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ColumnMappingTable
              columns={columns}
              allFields={allFields}
              editingCol={editingCol}
              setEditingCol={setEditingCol}
              updateMapping={updateMapping}
              updateDisplayName={updateDisplayName}
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <Button variant="outline" className="min-h-[44px]" onClick={() => setStep('upload')}>Back</Button>
              <Button className="min-h-[44px]" onClick={goToDistribute} disabled={!hasBizName}>
                Next: Distribute to Campaigns
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'distribute' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribute {rawData.length.toLocaleString()} Leads to Campaigns</CardTitle>
            <CardDescription>Assign how many leads go to each campaign. Remaining leads will be imported without a campaign.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <CampaignDistribution
              allocations={allocations}
              totalRows={rawData.length}
              totalAllocated={totalAllocated}
              unassigned={unassigned}
              updateAllocation={updateAllocation}
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <Button variant="outline" className="min-h-[44px]" onClick={() => setStep('mapping')}>Back</Button>
              <Button className="min-h-[44px]" onClick={startImport} disabled={totalAllocated > rawData.length}>
                Import {rawData.length.toLocaleString()} Leads
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'importing' && (
        <Card>
          <CardContent className="py-16 text-center">
            <h3 className="mb-4 text-lg font-semibold">Importing leads...</h3>
            <Progress value={progress} className="mx-auto mb-3 max-w-md" />
            <p className="text-sm text-muted-foreground">{progress}% complete</p>
          </CardContent>
        </Card>
      )}

      {step === 'done' && (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-score-high/15">
              <Check className="h-7 w-7 text-score-high" />
            </div>
            <h3 className="mb-1 text-lg font-semibold">Import Complete</h3>
            <p className="mb-1 text-sm text-muted-foreground">{importResult.imported.toLocaleString()} leads imported successfully</p>
            {importResult.failed > 0 && (
              <p className="text-sm text-destructive">{importResult.failed} rows failed</p>
            )}
            <Button className="mt-6" onClick={() => { setStep('upload'); setRawData([]); setColumns([]); setAllocations([]); }}>
              Import Another File
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
