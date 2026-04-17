
ALTER TABLE public.leads ADD COLUMN follow_up_date timestamptz;
ALTER TABLE public.call_logs ADD COLUMN follow_up_date timestamptz;
