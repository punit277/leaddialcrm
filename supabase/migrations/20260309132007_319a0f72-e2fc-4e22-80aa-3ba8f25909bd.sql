
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
