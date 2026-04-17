export const CALL_RESPONSES = [
  'Interested',
  'Follow Up',
  'Not Interested',
  'Busy',
  'Not Connected',
  'Wrong Number',
  'Already Has Website',
  'Skip',
] as const;

export type CallResponse = typeof CALL_RESPONSES[number];

export const LEAD_STATUSES = [
  'pending',
  'assigned',
  'completed',
  'follow_up',
  'skipped',
  'do_not_call',
] as const;

export type LeadStatus = typeof LEAD_STATUSES[number];

export const LEAD_SCORE_LABELS: Record<number, string> = {
  0: 'Low',
  1: 'Medium',
  2: 'High',
};

export const LEAD_SCORE_COLORS: Record<number, string> = {
  0: 'bg-score-low',
  1: 'bg-score-medium',
  2: 'bg-score-high',
};

export const CRM_FIELDS = [
  'business_name',
  'maps_link',
  'rating',
  'reviews_count',
  'category',
  'address_line1',
  'address_full',
  'open_status',
  'hours_detail',
  'description',
  'service_type',
  'phone_number',
  'photo_url',
  'website',
  'instagram',
  'facebook',
  'whatsapp',
  'ignore',
] as const;

export function computeLeadScore(rating: number | null, reviews: number | null): number {
  if (rating === null && reviews === null) return 0;
  if ((rating ?? 0) >= 4.0 && (reviews ?? 0) >= 100) return 2;
  if ((rating ?? 0) >= 3.0 && (reviews ?? 0) >= 50) return 1;
  return 0;
}

export function getMapUrl(lead: { maps_link?: string | null; business_name?: string; address_full?: string | null }) {
  if (lead.maps_link) return lead.maps_link;
  const query = encodeURIComponent(`${lead.business_name || ''} ${lead.address_full || ''}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export function buildWhatsAppMessage(lead: Record<string, any>): string {
  const lines: string[] = [];
  lines.push(`Hi ${lead.business_name || 'there'}! 👋`);
  lines.push('');
  lines.push("I'm reaching out regarding your business.");
  lines.push('');
  if (lead.address_full || lead.address_line1) lines.push(`📍 ${lead.address_full || lead.address_line1}`);
  if (lead.phone_number) lines.push(`📞 ${lead.phone_number}`);
  if (lead.website) lines.push(`🌐 ${lead.website}`);
  if (lead.rating != null) {
    const reviewsPart = lead.reviews_count != null ? ` (${lead.reviews_count} reviews)` : '';
    lines.push(`⭐ Rating: ${lead.rating}${reviewsPart}`);
  }
  if (lead.category) lines.push(`📂 Category: ${lead.category}`);
  lines.push('');
  lines.push('Looking forward to connecting with you!');
  return lines.join('\n');
}
