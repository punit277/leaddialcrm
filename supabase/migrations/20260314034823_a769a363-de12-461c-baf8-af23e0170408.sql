
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
