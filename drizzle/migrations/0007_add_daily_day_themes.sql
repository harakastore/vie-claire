CREATE TABLE public.daily_day_themes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  day_date date NOT NULL,
  theme text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_day_themes_user_day_unique UNIQUE (user_id, day_date),
  CONSTRAINT daily_day_themes_theme_length CHECK (char_length(theme) <= 200)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_day_themes TO authenticated;
GRANT ALL ON public.daily_day_themes TO service_role;

ALTER TABLE public.daily_day_themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own daily day themes"
ON public.daily_day_themes FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily day themes"
ON public.daily_day_themes FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily day themes"
ON public.daily_day_themes FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own daily day themes"
ON public.daily_day_themes FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_daily_day_themes_user_date ON public.daily_day_themes(user_id, day_date);