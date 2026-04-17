-- ============================================================
-- Migration: 20260308190544_3ca4cfa8-d592-4368-bc8d-734cac301969.sql
-- ============================================================

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

-- ============================================================
-- Migration: 20260308190603_f64dd7db-594d-4bfc-8dc8-eb50350c4fa6.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.compute_lead_score(p_rating NUMERIC, p_reviews INTEGER)
RETURNS SMALLINT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF p_rating IS NULL AND p_reviews IS NULL THEN RETURN 0; END IF;
  IF COALESCE(p_rating, 0) >= 4.0 AND COALESCE(p_reviews, 0) >= 100 THEN RETURN 2; END IF;
  IF COALESCE(p_rating, 0) >= 3.0 AND COALESCE(p_reviews, 0) >= 50 THEN RETURN 1; END IF;
  RETURN 0;
END;
$$;

-- ============================================================
-- Migration: 20260308191439_20bef49e-0844-4caa-8a98-bf1b78ceb2f4.sql
-- ============================================================

-- Allow new users to insert their own role during signup
CREATE POLICY "Users can insert own role on signup"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Migration: 20260308191516_636ec11d-ea99-4b7e-8838-280c75ab2426.sql
-- ============================================================

-- Fix all RLS policies to be PERMISSIVE (default) instead of RESTRICTIVE

-- Drop and recreate user_roles policies
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert own role on signup" ON public.user_roles;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own role on signup" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Drop and recreate profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Drop and recreate leads policies
DROP POLICY IF EXISTS "Admins can do everything with leads" ON public.leads;
DROP POLICY IF EXISTS "Agents can view assigned leads" ON public.leads;
DROP POLICY IF EXISTS "Agents can view pending leads" ON public.leads;
DROP POLICY IF EXISTS "Agents can update assigned leads" ON public.leads;

CREATE POLICY "Admins can do everything with leads" ON public.leads FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Agents can view assigned leads" ON public.leads FOR SELECT TO authenticated USING (assigned_to = auth.uid());
CREATE POLICY "Agents can view pending leads" ON public.leads FOR SELECT TO authenticated USING (lead_status IN ('pending', 'follow_up') AND assigned_to IS NULL);
CREATE POLICY "Agents can update assigned leads" ON public.leads FOR UPDATE TO authenticated USING (assigned_to = auth.uid());

-- Drop and recreate call_logs policies
DROP POLICY IF EXISTS "Admins can view all call logs" ON public.call_logs;
DROP POLICY IF EXISTS "Agents can insert call logs" ON public.call_logs;
DROP POLICY IF EXISTS "Agents can view own call logs" ON public.call_logs;

CREATE POLICY "Admins can view all call logs" ON public.call_logs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Agents can insert call logs" ON public.call_logs FOR INSERT TO authenticated WITH CHECK (agent_id = auth.uid());
CREATE POLICY "Agents can view own call logs" ON public.call_logs FOR SELECT TO authenticated USING (agent_id = auth.uid());

-- Drop and recreate lead_assignments policies
DROP POLICY IF EXISTS "Admins can view all assignments" ON public.lead_assignments;
DROP POLICY IF EXISTS "Agents can view own assignments" ON public.lead_assignments;
DROP POLICY IF EXISTS "Agents can insert assignments" ON public.lead_assignments;

CREATE POLICY "Admins can view all assignments" ON public.lead_assignments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Agents can view own assignments" ON public.lead_assignments FOR SELECT TO authenticated USING (agent_id = auth.uid());
CREATE POLICY "Agents can insert assignments" ON public.lead_assignments FOR INSERT TO authenticated WITH CHECK (agent_id = auth.uid());

-- Drop and recreate import_batches policies
DROP POLICY IF EXISTS "Admins can manage imports" ON public.import_batches;

CREATE POLICY "Admins can manage imports" ON public.import_batches FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- Migration: 20260308192349_3d52f826-670d-4fd1-ad3a-1e460f2cac15.sql
-- ============================================================

-- Drop all RESTRICTIVE policies and recreate as PERMISSIVE

-- LEADS table
DROP POLICY IF EXISTS "Admins can do everything with leads" ON public.leads;
DROP POLICY IF EXISTS "Agents can view assigned leads" ON public.leads;
DROP POLICY IF EXISTS "Agents can view pending leads" ON public.leads;
DROP POLICY IF EXISTS "Agents can update assigned leads" ON public.leads;

CREATE POLICY "Admins can do everything with leads" ON public.leads FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Agents can view assigned leads" ON public.leads FOR SELECT TO authenticated USING (assigned_to = auth.uid());
CREATE POLICY "Agents can view pending leads" ON public.leads FOR SELECT TO authenticated USING (lead_status IN ('pending', 'follow_up') AND assigned_to IS NULL);
CREATE POLICY "Agents can update assigned leads" ON public.leads FOR UPDATE TO authenticated USING (assigned_to = auth.uid());
CREATE POLICY "Agents can update unassigned leads" ON public.leads FOR UPDATE TO authenticated USING (lead_status IN ('pending', 'follow_up') AND assigned_to IS NULL);

-- CALL_LOGS table
DROP POLICY IF EXISTS "Admins can view all call logs" ON public.call_logs;
DROP POLICY IF EXISTS "Agents can insert call logs" ON public.call_logs;
DROP POLICY IF EXISTS "Agents can view own call logs" ON public.call_logs;

CREATE POLICY "Admins can view all call logs" ON public.call_logs FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Agents can insert call logs" ON public.call_logs FOR INSERT TO authenticated WITH CHECK (agent_id = auth.uid());
CREATE POLICY "Agents can view own call logs" ON public.call_logs FOR SELECT TO authenticated USING (agent_id = auth.uid());

-- LEAD_ASSIGNMENTS table
DROP POLICY IF EXISTS "Admins can view all assignments" ON public.lead_assignments;
DROP POLICY IF EXISTS "Agents can view own assignments" ON public.lead_assignments;
DROP POLICY IF EXISTS "Agents can insert assignments" ON public.lead_assignments;

CREATE POLICY "Admins can view all assignments" ON public.lead_assignments FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Agents can view own assignments" ON public.lead_assignments FOR SELECT TO authenticated USING (agent_id = auth.uid());
CREATE POLICY "Agents can insert assignments" ON public.lead_assignments FOR INSERT TO authenticated WITH CHECK (agent_id = auth.uid());

-- IMPORT_BATCHES table
DROP POLICY IF EXISTS "Admins can manage imports" ON public.import_batches;
CREATE POLICY "Admins can manage imports" ON public.import_batches FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- PROFILES table
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- USER_ROLES table
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert own role on signup" ON public.user_roles;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own role on signup" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Migration: 20260308192937_102da9ea-81e0-4cfe-9143-57d9a12fdf42.sql
-- ============================================================

INSERT INTO public.user_roles (user_id, role)
VALUES ('9b5adda9-f132-4e28-817e-a9c6e15331b6', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- ============================================================
-- Migration: 20260308195016_b8aecc6b-be3d-40ac-8eb7-8161cb875da3.sql
-- ============================================================
-- Add phone_number column to leads
ALTER TABLE public.leads ADD COLUMN phone_number varchar NULL;

-- === LEADS ===
DROP POLICY IF EXISTS "Admins can do everything with leads" ON public.leads;
DROP POLICY IF EXISTS "Agents can view assigned leads" ON public.leads;
DROP POLICY IF EXISTS "Agents can view pending leads" ON public.leads;
DROP POLICY IF EXISTS "Agents can update assigned leads" ON public.leads;
DROP POLICY IF EXISTS "Agents can update unassigned leads" ON public.leads;

CREATE POLICY "Admins can do everything with leads" ON public.leads
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents can view assigned leads" ON public.leads
  FOR SELECT TO authenticated
  USING (assigned_to = auth.uid());

CREATE POLICY "Agents can view pending leads" ON public.leads
  FOR SELECT TO authenticated
  USING (lead_status IN ('pending', 'follow_up') AND assigned_to IS NULL);

CREATE POLICY "Agents can update assigned leads" ON public.leads
  FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid());

CREATE POLICY "Agents can update unassigned leads" ON public.leads
  FOR UPDATE TO authenticated
  USING (lead_status IN ('pending', 'follow_up') AND assigned_to IS NULL);

-- === CALL_LOGS ===
DROP POLICY IF EXISTS "Admins can view all call logs" ON public.call_logs;
DROP POLICY IF EXISTS "Agents can insert call logs" ON public.call_logs;
DROP POLICY IF EXISTS "Agents can view own call logs" ON public.call_logs;

CREATE POLICY "Admins can view all call logs" ON public.call_logs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents can view own call logs" ON public.call_logs
  FOR SELECT TO authenticated
  USING (agent_id = auth.uid());

CREATE POLICY "Agents can insert call logs" ON public.call_logs
  FOR INSERT TO authenticated
  WITH CHECK (agent_id = auth.uid());

-- === LEAD_ASSIGNMENTS ===
DROP POLICY IF EXISTS "Admins can view all assignments" ON public.lead_assignments;
DROP POLICY IF EXISTS "Agents can view own assignments" ON public.lead_assignments;
DROP POLICY IF EXISTS "Agents can insert assignments" ON public.lead_assignments;

CREATE POLICY "Admins can view all assignments" ON public.lead_assignments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents can view own assignments" ON public.lead_assignments
  FOR SELECT TO authenticated
  USING (agent_id = auth.uid());

CREATE POLICY "Agents can insert assignments" ON public.lead_assignments
  FOR INSERT TO authenticated
  WITH CHECK (agent_id = auth.uid());

-- === IMPORT_BATCHES ===
DROP POLICY IF EXISTS "Admins can manage imports" ON public.import_batches;

CREATE POLICY "Admins can manage imports" ON public.import_batches
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- === PROFILES ===
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- === USER_ROLES ===
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert own role on signup" ON public.user_roles;

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own role on signup" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
-- ============================================================
-- Migration: 20260308195803_d1745a6e-6313-4809-bab0-ba96e03af2ed.sql
-- ============================================================

-- Fix all RLS policies: drop RESTRICTIVE ones and recreate as PERMISSIVE

-- === LEADS ===
DROP POLICY IF EXISTS "Admins can do everything with leads" ON public.leads;
DROP POLICY IF EXISTS "Agents can view assigned leads" ON public.leads;
DROP POLICY IF EXISTS "Agents can view pending leads" ON public.leads;
DROP POLICY IF EXISTS "Agents can update assigned leads" ON public.leads;
DROP POLICY IF EXISTS "Agents can update unassigned leads" ON public.leads;

CREATE POLICY "Admins full access leads" ON public.leads AS PERMISSIVE
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents select assigned leads" ON public.leads AS PERMISSIVE
  FOR SELECT TO authenticated USING (assigned_to = auth.uid());

CREATE POLICY "Agents select pending leads" ON public.leads AS PERMISSIVE
  FOR SELECT TO authenticated USING (lead_status IN ('pending', 'follow_up') AND assigned_to IS NULL);

CREATE POLICY "Agents update assigned leads" ON public.leads AS PERMISSIVE
  FOR UPDATE TO authenticated USING (assigned_to = auth.uid());

CREATE POLICY "Agents update unassigned leads" ON public.leads AS PERMISSIVE
  FOR UPDATE TO authenticated USING (lead_status IN ('pending', 'follow_up') AND assigned_to IS NULL);

-- === CALL_LOGS ===
DROP POLICY IF EXISTS "Admins can view all call logs" ON public.call_logs;
DROP POLICY IF EXISTS "Agents can view own call logs" ON public.call_logs;
DROP POLICY IF EXISTS "Agents can insert call logs" ON public.call_logs;

CREATE POLICY "Admins full access call_logs" ON public.call_logs AS PERMISSIVE
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents select own call_logs" ON public.call_logs AS PERMISSIVE
  FOR SELECT TO authenticated USING (agent_id = auth.uid());

CREATE POLICY "Agents insert own call_logs" ON public.call_logs AS PERMISSIVE
  FOR INSERT TO authenticated WITH CHECK (agent_id = auth.uid());

-- === LEAD_ASSIGNMENTS ===
DROP POLICY IF EXISTS "Admins can view all assignments" ON public.lead_assignments;
DROP POLICY IF EXISTS "Agents can view own assignments" ON public.lead_assignments;
DROP POLICY IF EXISTS "Agents can insert assignments" ON public.lead_assignments;

CREATE POLICY "Admins full access assignments" ON public.lead_assignments AS PERMISSIVE
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents select own assignments" ON public.lead_assignments AS PERMISSIVE
  FOR SELECT TO authenticated USING (agent_id = auth.uid());

CREATE POLICY "Agents insert own assignments" ON public.lead_assignments AS PERMISSIVE
  FOR INSERT TO authenticated WITH CHECK (agent_id = auth.uid());

-- === IMPORT_BATCHES ===
DROP POLICY IF EXISTS "Admins can manage imports" ON public.import_batches;

CREATE POLICY "Admins full access imports" ON public.import_batches AS PERMISSIVE
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- === PROFILES ===
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users view own profile" ON public.profiles AS PERMISSIVE
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "Admins view all profiles" ON public.profiles AS PERMISSIVE
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users update own profile" ON public.profiles AS PERMISSIVE
  FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users insert own profile" ON public.profiles AS PERMISSIVE
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- === USER_ROLES ===
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert own role on signup" ON public.user_roles;

CREATE POLICY "Users view own roles" ON public.user_roles AS PERMISSIVE
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins manage roles" ON public.user_roles AS PERMISSIVE
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users insert own role" ON public.user_roles AS PERMISSIVE
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Migration: 20260308200846_927d3571-3240-4f08-998d-56dce42e1e22.sql
-- ============================================================

-- Drop all existing RESTRICTIVE policies and recreate as PERMISSIVE

-- ========== leads ==========
DROP POLICY IF EXISTS "Admins full access leads" ON public.leads;
DROP POLICY IF EXISTS "Agents select assigned leads" ON public.leads;
DROP POLICY IF EXISTS "Agents select pending leads" ON public.leads;
DROP POLICY IF EXISTS "Agents update assigned leads" ON public.leads;
DROP POLICY IF EXISTS "Agents update unassigned leads" ON public.leads;

CREATE POLICY "Admins full access leads" ON public.leads FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents select leads" ON public.leads FOR SELECT TO authenticated
  USING (assigned_to = auth.uid() OR (lead_status IN ('pending','follow_up') AND assigned_to IS NULL));

CREATE POLICY "Agents update leads" ON public.leads FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid() OR (lead_status IN ('pending','follow_up') AND assigned_to IS NULL));

-- ========== call_logs ==========
DROP POLICY IF EXISTS "Admins full access call_logs" ON public.call_logs;
DROP POLICY IF EXISTS "Agents select own call_logs" ON public.call_logs;
DROP POLICY IF EXISTS "Agents insert own call_logs" ON public.call_logs;

CREATE POLICY "Admins full access call_logs" ON public.call_logs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents select own call_logs" ON public.call_logs FOR SELECT TO authenticated
  USING (agent_id = auth.uid());

CREATE POLICY "Agents insert own call_logs" ON public.call_logs FOR INSERT TO authenticated
  WITH CHECK (agent_id = auth.uid());

-- ========== import_batches ==========
DROP POLICY IF EXISTS "Admins full access imports" ON public.import_batches;

CREATE POLICY "Admins full access imports" ON public.import_batches FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- ========== lead_assignments ==========
DROP POLICY IF EXISTS "Admins full access assignments" ON public.lead_assignments;
DROP POLICY IF EXISTS "Agents select own assignments" ON public.lead_assignments;
DROP POLICY IF EXISTS "Agents insert own assignments" ON public.lead_assignments;

CREATE POLICY "Admins full access assignments" ON public.lead_assignments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents select own assignments" ON public.lead_assignments FOR SELECT TO authenticated
  USING (agent_id = auth.uid());

CREATE POLICY "Agents insert own assignments" ON public.lead_assignments FOR INSERT TO authenticated
  WITH CHECK (agent_id = auth.uid());

-- ========== profiles ==========
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;

CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- ========== user_roles ==========
DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users insert own role" ON public.user_roles;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users insert own role" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Migration: 20260308201740_0b300f90-4dab-44b0-b1ff-c132ef34ef80.sql
-- ============================================================
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
-- ============================================================
-- Migration: 20260308203445_4d348dd1-a2c2-452a-96ec-ad09df425e29.sql
-- ============================================================

-- Drop ALL existing policies on all tables
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END$$;

-- ========== LEADS ==========
CREATE POLICY "Admins full access leads" ON public.leads FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents select leads" ON public.leads FOR SELECT TO authenticated
  USING (
    assigned_to = auth.uid()
    OR (lead_status IN ('pending','follow_up') AND assigned_to IS NULL)
  );

CREATE POLICY "Agents update leads" ON public.leads FOR UPDATE TO authenticated
  USING (
    assigned_to = auth.uid()
    OR (lead_status IN ('pending','follow_up') AND assigned_to IS NULL)
  );

-- ========== CALL_LOGS ==========
CREATE POLICY "Admins full access call_logs" ON public.call_logs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents select own call_logs" ON public.call_logs FOR SELECT TO authenticated
  USING (agent_id = auth.uid());

CREATE POLICY "Agents insert own call_logs" ON public.call_logs FOR INSERT TO authenticated
  WITH CHECK (agent_id = auth.uid());

-- ========== IMPORT_BATCHES ==========
CREATE POLICY "Admins full access imports" ON public.import_batches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ========== LEAD_ASSIGNMENTS ==========
CREATE POLICY "Admins full access assignments" ON public.lead_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents select own assignments" ON public.lead_assignments FOR SELECT TO authenticated
  USING (agent_id = auth.uid());

CREATE POLICY "Agents insert own assignments" ON public.lead_assignments FOR INSERT TO authenticated
  WITH CHECK (agent_id = auth.uid());

-- ========== PROFILES ==========
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- ========== USER_ROLES ==========
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users insert own role" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ========== CAMPAIGNS ==========
CREATE POLICY "Admins full access campaigns" ON public.campaigns FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents select assigned campaigns" ON public.campaigns FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaign_assignments ca
      WHERE ca.campaign_id = campaigns.id AND ca.agent_id = auth.uid()
    )
  );

-- ========== CAMPAIGN_ASSIGNMENTS ==========
CREATE POLICY "Admins full access campaign_assignments" ON public.campaign_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents select own campaign_assignments" ON public.campaign_assignments FOR SELECT TO authenticated
  USING (agent_id = auth.uid());

-- ============================================================
-- Migration: 20260308205738_a8f33e8b-f9a4-4c10-9fd9-1a48d57fbac9.sql
-- ============================================================

ALTER TABLE public.leads ADD COLUMN follow_up_date timestamptz;
ALTER TABLE public.call_logs ADD COLUMN follow_up_date timestamptz;

-- ============================================================
-- Migration: 20260308211103_0d92908a-cb7e-4a09-8d91-0975c70f4af1.sql
-- ============================================================

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

-- ============================================================
-- Migration: 20260309132007_319a0f72-e2fc-4e22-80aa-3ba8f25909bd.sql
-- ============================================================

-- Drop all restrictive policies and recreate as permissive (default)

-- ========== call_logs ==========
DROP POLICY IF EXISTS "Admins full access call_logs" ON public.call_logs;
DROP POLICY IF EXISTS "Agents select own call_logs" ON public.call_logs;
DROP POLICY IF EXISTS "Agents insert own call_logs" ON public.call_logs;

CREATE POLICY "Admins full access call_logs" ON public.call_logs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Agents select own call_logs" ON public.call_logs FOR SELECT TO authenticated
  USING (agent_id = auth.uid());

CREATE POLICY "Agents insert own call_logs" ON public.call_logs FOR INSERT TO authenticated
  WITH CHECK (agent_id = auth.uid());

-- ========== campaign_assignments ==========
DROP POLICY IF EXISTS "Admins full access campaign_assignments" ON public.campaign_assignments;
DROP POLICY IF EXISTS "Agents select own campaign_assignments" ON public.campaign_assignments;

CREATE POLICY "Admins full access campaign_assignments" ON public.campaign_assignments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Agents select own campaign_assignments" ON public.campaign_assignments FOR SELECT TO authenticated
  USING (agent_id = auth.uid());

-- ========== campaigns ==========
DROP POLICY IF EXISTS "Admins full access campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Agents select assigned campaigns" ON public.campaigns;

CREATE POLICY "Admins full access campaigns" ON public.campaigns FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Agents select assigned campaigns" ON public.campaigns FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM campaign_assignments ca WHERE ca.campaign_id = campaigns.id AND ca.agent_id = auth.uid()));

-- ========== field_settings ==========
DROP POLICY IF EXISTS "Admins full access field_settings" ON public.field_settings;
DROP POLICY IF EXISTS "Agents select field_settings" ON public.field_settings;

CREATE POLICY "Admins full access field_settings" ON public.field_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Agents select field_settings" ON public.field_settings FOR SELECT TO authenticated
  USING (true);

-- ========== import_batches ==========
DROP POLICY IF EXISTS "Admins full access imports" ON public.import_batches;

CREATE POLICY "Admins full access imports" ON public.import_batches FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ========== lead_assignments ==========
DROP POLICY IF EXISTS "Admins full access assignments" ON public.lead_assignments;
DROP POLICY IF EXISTS "Agents select own assignments" ON public.lead_assignments;
DROP POLICY IF EXISTS "Agents insert own assignments" ON public.lead_assignments;

CREATE POLICY "Admins full access assignments" ON public.lead_assignments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Agents select own assignments" ON public.lead_assignments FOR SELECT TO authenticated
  USING (agent_id = auth.uid());

CREATE POLICY "Agents insert own assignments" ON public.lead_assignments FOR INSERT TO authenticated
  WITH CHECK (agent_id = auth.uid());

-- ========== leads ==========
DROP POLICY IF EXISTS "Admins full access leads" ON public.leads;
DROP POLICY IF EXISTS "Agents select leads" ON public.leads;
DROP POLICY IF EXISTS "Agents update leads" ON public.leads;

CREATE POLICY "Admins full access leads" ON public.leads FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Agents select leads" ON public.leads FOR SELECT TO authenticated
  USING (assigned_to = auth.uid() OR (lead_status IN ('pending', 'follow_up') AND assigned_to IS NULL));

CREATE POLICY "Agents update leads" ON public.leads FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid() OR (lead_status IN ('pending', 'follow_up') AND assigned_to IS NULL));

-- ========== profiles ==========
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;

CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- ========== user_roles ==========
DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users insert own role" ON public.user_roles;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users insert own role" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Migration: 20260313131425_417278de-cb07-4af3-936e-fa2b592c01e1.sql
-- ============================================================

-- Drop the existing agents update policy and recreate with explicit WITH CHECK
DROP POLICY "Agents update leads" ON public.leads;

CREATE POLICY "Agents update leads" ON public.leads
  FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid())
  WITH CHECK (true);

-- ============================================================
-- Migration: 20260314034823_a769a363-de12-461c-baf8-af23e0170408.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.dispose_lead(
  p_lead_id uuid,
  p_agent_id uuid,
  p_call_response text,
  p_notes text DEFAULT NULL,
  p_follow_up_date timestamptz DEFAULT NULL,
  p_skip_count integer DEFAULT 0,
  p_not_connected_count integer DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_status text;
  v_updated_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM leads
    WHERE id = p_lead_id
      AND assigned_to = p_agent_id
      AND lead_status = 'assigned'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Lead not assigned to you or already disposed');
  END IF;

  IF p_call_response = 'Skip' THEN
    v_new_status := 'skipped';
  ELSIF p_follow_up_date IS NOT NULL THEN
    v_new_status := 'follow_up';
  ELSE
    v_new_status := 'completed';
  END IF;

  UPDATE leads SET
    call_response = p_call_response,
    called_at = now(),
    assigned_to = NULL,
    assigned_at = NULL,
    lead_status = v_new_status,
    follow_up_date = p_follow_up_date,
    skip_count = p_skip_count,
    not_connected_count = p_not_connected_count
  WHERE id = p_lead_id
    AND assigned_to = p_agent_id
    AND lead_status = 'assigned'
  RETURNING id INTO v_updated_id;

  IF v_updated_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Race condition: lead was modified');
  END IF;

  INSERT INTO call_logs (lead_id, agent_id, response, notes, follow_up_date)
  VALUES (p_lead_id, p_agent_id, p_call_response, p_notes, p_follow_up_date);

  RETURN json_build_object('success', true);
END;
$$;

-- ============================================================
-- Migration: 20260314035531_f529eaa4-ad6a-488b-9d2e-80089475527a.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.claim_lead(
  p_lead_id uuid,
  p_agent_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claimed leads%ROWTYPE;
BEGIN
  UPDATE leads SET
    assigned_to = p_agent_id,
    assigned_at = now(),
    lead_status = 'assigned'
  WHERE id = p_lead_id
    AND assigned_to IS NULL
    AND lead_status IN ('pending', 'follow_up')
  RETURNING * INTO v_claimed;

  IF v_claimed.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Lead already claimed');
  END IF;

  INSERT INTO lead_assignments (lead_id, agent_id)
  VALUES (p_lead_id, p_agent_id);

  RETURN json_build_object('success', true, 'lead', row_to_json(v_claimed));
END;
$$;

-- ============================================================
-- Migration: 20260314062554_6bf6ba41-5e12-466c-87e0-79abcb2d7593.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.claim_lead(p_lead_id uuid, p_agent_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claimed leads%ROWTYPE;
BEGIN
  -- Prevent double assignment
  IF EXISTS (SELECT 1 FROM leads WHERE assigned_to = p_agent_id AND lead_status = 'assigned') THEN
    RETURN json_build_object('success', false, 'error', 'You already have an active lead');
  END IF;

  UPDATE leads SET
    assigned_to = p_agent_id,
    assigned_at = now(),
    lead_status = 'assigned'
  WHERE id = p_lead_id
    AND assigned_to IS NULL
    AND lead_status IN ('pending', 'follow_up')
  RETURNING * INTO v_claimed;

  IF v_claimed.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Lead already claimed');
  END IF;

  INSERT INTO lead_assignments (lead_id, agent_id)
  VALUES (p_lead_id, p_agent_id);

  RETURN json_build_object('success', true, 'lead', row_to_json(v_claimed));
END;
$$;

