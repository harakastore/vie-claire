ALTER TABLE public.daily_habits 
ADD COLUMN IF NOT EXISTS days_of_week integer[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS sub_category text DEFAULT NULL;