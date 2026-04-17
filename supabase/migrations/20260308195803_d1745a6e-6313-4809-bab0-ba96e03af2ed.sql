
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
