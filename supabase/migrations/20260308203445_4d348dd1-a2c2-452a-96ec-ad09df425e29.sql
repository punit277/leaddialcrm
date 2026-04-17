
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
