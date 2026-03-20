
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS end_date date;
