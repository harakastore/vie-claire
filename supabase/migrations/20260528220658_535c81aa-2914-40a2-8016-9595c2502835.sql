CREATE TABLE public.hp_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT 'Discipline Absolue',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  days_count INTEGER NOT NULL DEFAULT 15,
  obj1_label TEXT NOT NULL DEFAULT 'Déficit',
  obj2_label TEXT NOT NULL DEFAULT 'Sport',
  obj3_label TEXT NOT NULL DEFAULT 'Fajr',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hp_config TO authenticated;
GRANT ALL ON public.hp_config TO service_role;

ALTER TABLE public.hp_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own hp_config" ON public.hp_config FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own hp_config" ON public.hp_config FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own hp_config" ON public.hp_config FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own hp_config" ON public.hp_config FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_hp_config_updated_at
BEFORE UPDATE ON public.hp_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();