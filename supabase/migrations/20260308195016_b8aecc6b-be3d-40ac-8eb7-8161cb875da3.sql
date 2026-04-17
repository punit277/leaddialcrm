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