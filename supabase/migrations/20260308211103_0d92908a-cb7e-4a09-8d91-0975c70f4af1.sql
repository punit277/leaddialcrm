
-- Add social/web columns to leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS instagram text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS facebook text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS whatsapp text;

-- Create field_settings table
CREATE TABLE public.field_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_name varchar NOT NULL UNIQUE,
  display_name varchar NOT NULL,
  visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.field_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access field_settings" ON public.field_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Agents select field_settings" ON public.field_settings
  FOR SELECT TO authenticated
  USING (true);

-- Seed default field settings
INSERT INTO public.field_settings (field_name, display_name, visible, sort_order) VALUES
  ('business_name', 'Business Name', true, 1),
  ('category', 'Category', true, 2),
  ('rating', 'Rating', true, 3),
  ('reviews_count', 'Reviews', true, 4),
  ('phone_number', 'Phone Number', true, 5),
  ('address_full', 'Full Address', true, 6),
  ('maps_link', 'Google Maps', true, 7),
  ('website', 'Website', true, 8),
  ('whatsapp', 'WhatsApp', true, 9),
  ('instagram', 'Instagram', true, 10),
  ('facebook', 'Facebook', true, 11),
  ('open_status', 'Open Status', true, 12),
  ('hours_detail', 'Hours', true, 13),
  ('description', 'Description', true, 14),
  ('service_type', 'Service Type', true, 15),
  ('photo_url', 'Photo', true, 16);
