
-- Drop the existing agents update policy and recreate with explicit WITH CHECK
DROP POLICY "Agents update leads" ON public.leads;

CREATE POLICY "Agents update leads" ON public.leads
  FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid())
  WITH CHECK (true);
