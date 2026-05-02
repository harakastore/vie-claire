CREATE TABLE public.daily_block_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  day_date date NOT NULL,
  block_key text NOT NULL,
  start_time time,
  end_time time,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, day_date, block_key)
);
ALTER TABLE public.daily_block_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own daily_block_overrides" ON public.daily_block_overrides FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own daily_block_overrides" ON public.daily_block_overrides FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own daily_block_overrides" ON public.daily_block_overrides FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own daily_block_overrides" ON public.daily_block_overrides FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_dbo_user_date ON public.daily_block_overrides(user_id, day_date);