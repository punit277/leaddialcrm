import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Check, AlertTriangle, Pencil } from 'lucide-react';

interface ColumnMapping {
  rawColumn: string;
  displayName: string;
  detectedField: string;
  confidence: number;
  samples: string[];
  isCustom?: boolean;
}

interface Props {
  columns: ColumnMapping[];
  allFields: readonly string[];
  editingCol: number | null;
  setEditingCol: (i: number | null) => void;
  updateMapping: (index: number, field: string) => void;
  updateDisplayName: (index: number, name: string) => void;
}

export function ColumnMappingTable({ columns, allFields, editingCol, setEditingCol, updateMapping, updateDisplayName }: Props) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Excel Column</TableHead>
            <TableHead>Sample Values</TableHead>
            <TableHead>Map To CRM Field</TableHead>
            <TableHead>Confidence</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {columns.map((col, i) => (
            <TableRow key={col.rawColumn}>
              <TableCell>
                {editingCol === i ? (
                  <Input
                    value={col.displayName}
                    onChange={e => updateDisplayName(i, e.target.value)}
                    onBlur={() => setEditingCol(null)}
                    onKeyDown={e => e.key === 'Enter' && setEditingCol(null)}
                    autoFocus
                    className="h-7 text-sm w-[140px]"
                  />
                ) : (
                  <button onClick={() => setEditingCol(i)} className="flex items-center gap-1.5 font-mono text-sm hover:text-primary transition-colors">
                    {col.displayName}
                    <Pencil className="h-3 w-3 text-muted-foreground" />
                  </button>
                )}
                {col.displayName !== col.rawColumn && (
                  <span className="text-[10px] text-muted-foreground font-mono block">was: {col.rawColumn}</span>
                )}
              </TableCell>
              <TableCell className="max-w-[200px]">
                <p className="text-xs text-muted-foreground truncate">{col.samples.join(', ')}</p>
              </TableCell>
              <TableCell>
                <Select value={col.detectedField} onValueChange={v => updateMapping(i, v)}>
                  <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {allFields.map(f => (
                      <SelectItem key={f} value={f} className="capitalize">
                        {f === 'custom' ? '📦 Custom Field (raw_data)' : f.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Badge variant={col.confidence >= 70 ? 'default' : 'destructive'} className="text-xs">
                  {col.confidence >= 70 ? <Check className="mr-1 h-3 w-3" /> : <AlertTriangle className="mr-1 h-3 w-3" />}
                  {col.confidence}%
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
