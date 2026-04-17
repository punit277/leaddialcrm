
-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'agent');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- Create import_batches table
CREATE TABLE public.import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  filename VARCHAR(512),
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  total_rows INTEGER DEFAULT 0,
  imported_rows INTEGER DEFAULT 0,
  failed_rows INTEGER DEFAULT 0,
  column_mapping JSONB,
  detection_result JSONB,
  error_log JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Create leads table
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id UUID REFERENCES public.import_batches(id),
  business_name VARCHAR(512) NOT NULL,
  maps_link TEXT,
  rating NUMERIC(3,1),
  reviews_count INTEGER,
  category VARCHAR(128),
  address_line1 VARCHAR(512),
  address_full VARCHAR(512),
  open_status VARCHAR(64),
  hours_detail VARCHAR(256),
  description TEXT,
  service_type VARCHAR(128),
  photo_url TEXT,
  lead_score SMALLINT NOT NULL DEFAULT 0,
  lead_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  call_response VARCHAR(64),
  assigned_to UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ,
  called_at TIMESTAMPTZ,
  skip_count INTEGER NOT NULL DEFAULT 0,
  not_connected_count INTEGER NOT NULL DEFAULT 0,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create call_logs table
CREATE TABLE public.call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES auth.users(id),
  response VARCHAR(64) NOT NULL,
  notes TEXT,
  called_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create lead_assignments table
CREATE TABLE public.lead_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes on leads
CREATE INDEX idx_leads_status ON public.leads(lead_status);
CREATE INDEX idx_leads_score ON public.leads(lead_score);
CREATE INDEX idx_leads_batch ON public.leads(import_batch_id);
CREATE INDEX idx_leads_assigned ON public.leads(assigned_to);
CREATE INDEX idx_leads_name ON public.leads(business_name text_pattern_ops);

-- Indexes on call_logs
CREATE INDEX idx_call_logs_lead ON public.call_logs(lead_id);
CREATE INDEX idx_call_logs_agent ON public.call_logs(agent_id);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_assignments ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- User roles policies
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Import batches policies
CREATE POLICY "Admins can manage imports" ON public.import_batches FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Leads policies
CREATE POLICY "Admins can do everything with leads" ON public.leads FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Agents can view assigned leads" ON public.leads FOR SELECT USING (assigned_to = auth.uid());
CREATE POLICY "Agents can view pending leads" ON public.leads FOR SELECT USING (lead_status IN ('pending', 'follow_up') AND assigned_to IS NULL);
CREATE POLICY "Agents can update assigned leads" ON public.leads FOR UPDATE USING (assigned_to = auth.uid());

-- Call logs policies
CREATE POLICY "Admins can view all call logs" ON public.call_logs FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Agents can insert call logs" ON public.call_logs FOR INSERT WITH CHECK (agent_id = auth.uid());
CREATE POLICY "Agents can view own call logs" ON public.call_logs FOR SELECT USING (agent_id = auth.uid());

-- Lead assignments policies
CREATE POLICY "Admins can view all assignments" ON public.lead_assignments FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Agents can view own assignments" ON public.lead_assignments FOR SELECT USING (agent_id = auth.uid());
CREATE POLICY "Agents can insert assignments" ON public.lead_assignments FOR INSERT WITH CHECK (agent_id = auth.uid());

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Lead scoring function
CREATE OR REPLACE FUNCTION public.compute_lead_score(p_rating NUMERIC, p_reviews INTEGER)
RETURNS SMALLINT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_rating IS NULL AND p_reviews IS NULL THEN RETURN 0; END IF;
  IF COALESCE(p_rating, 0) >= 4.0 AND COALESCE(p_reviews, 0) >= 100 THEN RETURN 2; END IF;
  IF COALESCE(p_rating, 0) >= 3.0 AND COALESCE(p_reviews, 0) >= 50 THEN RETURN 1; END IF;
  RETURN 0;
END;
$$;
