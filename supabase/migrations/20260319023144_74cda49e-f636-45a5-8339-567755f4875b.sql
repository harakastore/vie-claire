ALTER TABLE public.weekly_sports ADD COLUMN IF NOT EXISTS kcal_eaten integer DEFAULT 0;
ALTER TABLE public.weekly_sports ADD COLUMN IF NOT EXISTS kcal_burned integer DEFAULT 0;