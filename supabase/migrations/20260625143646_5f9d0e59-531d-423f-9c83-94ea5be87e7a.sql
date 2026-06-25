
CREATE TABLE public.sport_disciplines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  type TEXT NOT NULL DEFAULT 'max',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sport_disciplines TO authenticated;
GRANT ALL ON public.sport_disciplines TO service_role;
ALTER TABLE public.sport_disciplines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sport_disciplines" ON public.sport_disciplines FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.sport_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  discipline_id UUID NOT NULL REFERENCES public.sport_disciplines(id) ON DELETE CASCADE,
  value NUMERIC NOT NULL,
  recorded_at DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sport_records TO authenticated;
GRANT ALL ON public.sport_records TO service_role;
ALTER TABLE public.sport_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sport_records" ON public.sport_records FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.dca_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  monthly_amount NUMERIC NOT NULL DEFAULT 0,
  day_of_month INT NOT NULL DEFAULT 1,
  currency TEXT NOT NULL DEFAULT 'MAD',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dca_assets TO authenticated;
GRANT ALL ON public.dca_assets TO service_role;
ALTER TABLE public.dca_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own dca_assets" ON public.dca_assets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.dca_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.dca_assets(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  contributed_at DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dca_contributions TO authenticated;
GRANT ALL ON public.dca_contributions TO service_role;
ALTER TABLE public.dca_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own dca_contributions" ON public.dca_contributions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_sport_disciplines_updated BEFORE UPDATE ON public.sport_disciplines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_dca_assets_updated BEFORE UPDATE ON public.dca_assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
