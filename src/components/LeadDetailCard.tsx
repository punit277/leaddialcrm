import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScoreBadge } from '@/components/ScoreBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { getMapUrl, buildWhatsAppMessage } from '@/lib/constants';
import {
  Phone, MapPin, Star, ExternalLink, Globe, MessageCircle,
  Instagram, Facebook, Send, Search,
} from 'lucide-react';

interface FieldSetting {
  field_name: string;
  display_name: string;
  visible: boolean;
  sort_order: number;
}

interface LeadDetailCardProps {
  lead: Record<string, any>;
  compact?: boolean;
}

function cleanPhone(phone: string) {
  return phone.replace(/[^+\d]/g, '');
}

export function LeadDetailCard({ lead, compact = false }: LeadDetailCardProps) {
  const [fields, setFields] = useState<FieldSetting[]>([]);

  useEffect(() => {
    supabase.from('field_settings').select('*').order('sort_order').then(({ data }) => {
      if (data) setFields(data as FieldSetting[]);
    });
  }, []);

  const isVisible = (name: string) => {
    const f = fields.find(s => s.field_name === name);
    return f ? f.visible : true;
  };

  const label = (name: string) => {
    const f = fields.find(s => s.field_name === name);
    return f?.display_name || name.replace(/_/g, ' ');
  };

  const phone = lead.phone_number ? cleanPhone(lead.phone_number) : null;
  const waNumber = lead.whatsapp ? cleanPhone(lead.whatsapp) : phone;

  // Action buttons
  const actions: { icon: React.ReactNode; label: string; href: string; color?: string }[] = [];
  if (phone && isVisible('phone_number')) {
    actions.push({ icon: <Phone className="h-4 w-4" />, label: 'Call', href: `tel:${phone}`, color: 'text-score-high' });
  }
  if (waNumber && isVisible('whatsapp')) {
    actions.push({ icon: <MessageCircle className="h-4 w-4" />, label: 'WhatsApp', href: `https://wa.me/${waNumber.replace('+', '')}` });
    const msg = buildWhatsAppMessage(lead);
    actions.push({ icon: <Send className="h-4 w-4" />, label: 'Send Details', href: `https://wa.me/${waNumber.replace('+', '')}?text=${encodeURIComponent(msg)}` });
  }
  if (lead.website && isVisible('website')) {
    actions.push({ icon: <Globe className="h-4 w-4" />, label: 'Website', href: lead.website });
  }
  if (isVisible('maps_link')) {
    actions.push({ icon: <MapPin className="h-4 w-4" />, label: 'Maps', href: getMapUrl(lead) });
  }
  if (lead.instagram && isVisible('instagram')) {
    const igUrl = lead.instagram.startsWith('http') ? lead.instagram : `https://instagram.com/${lead.instagram.replace('@', '')}`;
    actions.push({ icon: <Instagram className="h-4 w-4" />, label: 'Instagram', href: igUrl });
  }
  if (lead.facebook && isVisible('facebook')) {
    const fbUrl = lead.facebook.startsWith('http') ? lead.facebook : `https://facebook.com/${lead.facebook}`;
    actions.push({ icon: <Facebook className="h-4 w-4" />, label: 'Facebook', href: fbUrl });
  }

  // Verify buttons
  const verifyQuery = encodeURIComponent(`${lead.business_name || ''} ${lead.address_full || lead.address_line1 || ''}`);
  actions.push({ icon: <Search className="h-4 w-4" />, label: 'Verify', href: `https://www.google.com/search?q=${verifyQuery}` });
  actions.push({ icon: <MapPin className="h-4 w-4" />, label: 'Maps Verify', href: `https://www.google.com/maps/search/${verifyQuery}` });

  const detailRows: { key: string; label: string; value: React.ReactNode }[] = [];

  if (lead.rating && isVisible('rating')) {
    detailRows.push({
      key: 'rating',
      label: label('rating'),
      value: (
        <span className="flex items-center gap-1">
          <Star className="h-4 w-4 fill-score-medium text-score-medium" />
          <strong>{lead.rating}</strong>
        </span>
      ),
    });
  }
  if (lead.reviews_count != null && isVisible('reviews_count')) {
    detailRows.push({ key: 'reviews', label: label('reviews_count'), value: lead.reviews_count.toLocaleString() });
  }
  if (lead.category && isVisible('category')) {
    detailRows.push({ key: 'category', label: label('category'), value: lead.category });
  }
  if ((lead.address_full || lead.address_line1) && isVisible('address_full')) {
    detailRows.push({ key: 'address', label: label('address_full'), value: lead.address_full || lead.address_line1 });
  }
  if (lead.phone_number && isVisible('phone_number')) {
    detailRows.push({
      key: 'phone',
      label: label('phone_number'),
      value: <a href={`tel:${phone}`} className="text-primary font-medium">{lead.phone_number}</a>,
    });
  }
  if (lead.open_status && isVisible('open_status')) {
    detailRows.push({
      key: 'status',
      label: label('open_status'),
      value: (
        <span className={lead.open_status.toLowerCase().includes('open') ? 'text-score-high font-medium' : 'text-destructive font-medium'}>
          {lead.open_status}
        </span>
      ),
    });
  }
  if (lead.hours_detail && isVisible('hours_detail')) {
    detailRows.push({ key: 'hours', label: label('hours_detail'), value: lead.hours_detail });
  }
  if (lead.service_type && isVisible('service_type')) {
    detailRows.push({ key: 'service', label: label('service_type'), value: lead.service_type });
  }
  if (lead.description && isVisible('description')) {
    detailRows.push({ key: 'desc', label: label('description'), value: <span className="text-muted-foreground text-xs leading-relaxed">{lead.description.slice(0, 300)}</span> });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      {lead.photo_url && isVisible('photo_url') && (
        <div className="h-44 rounded-lg bg-muted overflow-hidden">
          <img src={lead.photo_url} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold leading-tight truncate">{lead.business_name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {lead.category && <Badge variant="secondary" className="text-xs">{lead.category}</Badge>}
            <StatusBadge status={lead.lead_status} />
          </div>
        </div>
        <ScoreBadge score={lead.lead_score} />
      </div>

      {/* Action Buttons */}
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map(a => (
            <Button key={a.label} variant="outline" size="sm" className="gap-2 min-h-[40px]" asChild>
              <a href={a.href} target={a.href.startsWith('tel:') ? undefined : '_blank'} rel="noopener noreferrer">
                {a.icon} {a.label}
              </a>
            </Button>
          ))}
        </div>
      )}

      {/* Detail Grid */}
      <div className={compact ? 'space-y-2' : 'grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3'}>
        {detailRows.map(row => (
          <div key={row.key} className="flex flex-col">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{row.label}</span>
            <span className="text-sm mt-0.5">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
