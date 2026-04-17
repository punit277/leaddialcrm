
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
