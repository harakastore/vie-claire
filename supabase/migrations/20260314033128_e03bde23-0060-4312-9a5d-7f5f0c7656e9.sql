CREATE TABLE public.salat_times (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  month integer NOT NULL,
  year integer NOT NULL,
  fajr time NOT NULL DEFAULT '06:00',
  dhuhr time NOT NULL DEFAULT '13:00',
  asr time NOT NULL DEFAULT '16:30',
  maghrib time NOT NULL DEFAULT '18:30',
  isha time NOT NULL DEFAULT '20:00',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, month, year)
);

ALTER TABLE public.salat_times ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own salat_times" ON public.salat_times FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own salat_times" ON public.salat_times FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own salat_times" ON public.salat_times FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own salat_times" ON public.salat_times FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE public.daily_tasks ADD COLUMN IF NOT EXISTS block text NOT NULL DEFAULT 'fajr_dhuhr';