import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown, Save, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface FieldSetting {
  id: string;
  field_name: string;
  display_name: string;
  visible: boolean;
  sort_order: number;
}

export default function FieldSettings() {
  const [fields, setFields] = useState<FieldSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const dragNode = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    supabase.from('field_settings').select('*').order('sort_order').then(({ data }) => {
      if (data) setFields(data as FieldSetting[]);
      setLoading(false);
    });
  }, []);

  const toggleVisible = (id: string) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, visible: !f.visible } : f));
  };

  const updateName = (id: string, name: string) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, display_name: name } : f));
  };

  const reorder = (from: number, to: number) => {
    if (from === to) return;
    setFields(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next.map((f, i) => ({ ...f, sort_order: i + 1 }));
    });
  };

  const moveUp = (index: number) => { if (index > 0) reorder(index, index - 1); };
  const moveDown = (index: number) => { if (index < fields.length - 1) reorder(index, index + 1); };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index);
    dragNode.current = e.currentTarget as HTMLDivElement;
    e.dataTransfer.effectAllowed = 'move';
    // Make the drag image slightly transparent
    requestAnimationFrame(() => {
      if (dragNode.current) dragNode.current.style.opacity = '0.4';
    });
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragIndex !== null && index !== dragIndex) {
      setHoverIndex(index);
    }
  };

  const handleDragEnd = () => {
    if (dragNode.current) dragNode.current.style.opacity = '1';
    if (dragIndex !== null && hoverIndex !== null) {
      reorder(dragIndex, hoverIndex);
    }
    setDragIndex(null);
    setHoverIndex(null);
    dragNode.current = null;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const save = async () => {
    setSaving(true);
    for (const f of fields) {
      await supabase.from('field_settings').update({
        display_name: f.display_name,
        visible: f.visible,
        sort_order: f.sort_order,
      }).eq('id', f.id);
    }
    setSaving(false);
    toast.success('Field settings saved');
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Field Settings</h1>
        <p className="text-sm text-muted-foreground">Control which fields appear in lead views and customize labels</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">CRM Fields</CardTitle>
          <CardDescription>Drag to reorder, toggle visibility, and rename labels</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {fields.map((field, i) => (
            <div
              key={field.id}
              draggable
              onDragStart={e => handleDragStart(e, i)}
              onDragOver={e => handleDragOver(e, i)}
              onDragEnd={handleDragEnd}
              onDrop={handleDrop}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-3 transition-all cursor-grab active:cursor-grabbing",
                dragIndex === i && "opacity-40",
                hoverIndex === i && dragIndex !== null && "border-primary ring-2 ring-primary/20",
              )}
            >
              <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Switch checked={field.visible} onCheckedChange={() => toggleVisible(field.id)} />
              <div className="flex-1 min-w-0">
                <Input
                  value={field.display_name}
                  onChange={e => updateName(field.id, e.target.value)}
                  className="h-8 text-sm"
                />
                <span className="text-[10px] text-muted-foreground font-mono">{field.field_name}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveUp(i)} disabled={i === 0}>
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveDown(i)} disabled={i >= fields.length - 1}>
                  <ArrowDown className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}

          <Button className="mt-4 w-full gap-2 min-h-[44px]" onClick={save} disabled={saving}>
            <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
