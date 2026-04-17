-- Create campaigns table
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL,
  description text,
  status varchar NOT NULL DEFAULT 'active',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- Create campaign_assignments table
CREATE TABLE public.campaign_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, agent_id)
);

ALTER TABLE public.campaign_assignments ENABLE ROW LEVEL SECURITY;

-- RLS for campaigns
CREATE POLICY "Admins full access campaigns" ON public.campaigns FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents select assigned campaigns" ON public.campaigns FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.campaign_assignments ca WHERE ca.campaign_id = id AND ca.agent_id = auth.uid()));

-- RLS for campaign_assignments
CREATE POLICY "Admins full access campaign_assignments" ON public.campaign_assignments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents select own campaign_assignments" ON public.campaign_assignments FOR SELECT TO authenticated
  USING (agent_id = auth.uid());

-- Add campaign_id to leads
ALTER TABLE public.leads ADD COLUMN campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL;

-- Updated_at trigger for campaigns
CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();