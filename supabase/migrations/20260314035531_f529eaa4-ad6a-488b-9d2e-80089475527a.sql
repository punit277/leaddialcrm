
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
