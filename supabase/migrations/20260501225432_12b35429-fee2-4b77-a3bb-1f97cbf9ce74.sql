
CREATE TABLE public.hp_daily (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  day_date DATE NOT NULL,
  priority1_title TEXT DEFAULT '',
  priority1_done BOOLEAN NOT NULL DEFAULT false,
  priority2_title TEXT DEFAULT '',
  priority2_done BOOLEAN NOT NULL DEFAULT false,
  priority3_title TEXT DEFAULT '',
  priority3_done BOOLEAN NOT NULL DEFAULT false,
  salat_done BOOLEAN NOT NULL DEFAULT false,
  sport_done BOOLEAN NOT NULL DEFAULT false,
  deep_work_done BOOLEAN NOT NULL DEFAULT false,
  no_social_done BOOLEAN NOT NULL DEFAULT false,
  leads_count INTEGER DEFAULT 0,
  cost_per_lead NUMERIC DEFAULT 0,
  revenue NUMERIC DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, day_date)
);

ALTER TABLE public.hp_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own hp_daily" ON public.hp_daily FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own hp_daily" ON public.hp_daily FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own hp_daily" ON public.hp_daily FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own hp_daily" ON public.hp_daily FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_hp_daily_updated_at
BEFORE UPDATE ON public.hp_daily
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.hp_challenge (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  challenge_start DATE NOT NULL,
  day_number INTEGER NOT NULL CHECK (day_number BETWEEN 1 AND 16),
  sport BOOLEAN NOT NULL DEFAULT false,
  deficit BOOLEAN NOT NULL DEFAULT false,
  fajr BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, challenge_start, day_number)
);

ALTER TABLE public.hp_challenge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own hp_challenge" ON public.hp_challenge FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own hp_challenge" ON public.hp_challenge FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own hp_challenge" ON public.hp_challenge FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own hp_challenge" ON public.hp_challenge FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_hp_challenge_updated_at
BEFORE UPDATE ON public.hp_challenge
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
