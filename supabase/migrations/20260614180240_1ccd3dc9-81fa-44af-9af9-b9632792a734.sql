
-- ============ CABINET ============
CREATE TABLE public.cabinet_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('todo','maintenance','maintenance_routine','brainstorm','sop')),
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done')),
  frequency TEXT,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cabinet_tasks TO authenticated;
GRANT ALL ON public.cabinet_tasks TO service_role;
ALTER TABLE public.cabinet_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cabinet_tasks" ON public.cabinet_tasks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER cabinet_tasks_updated BEFORE UPDATE ON public.cabinet_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.cabinet_marketing_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done')),
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cabinet_marketing_strategies TO authenticated;
GRANT ALL ON public.cabinet_marketing_strategies TO service_role;
ALTER TABLE public.cabinet_marketing_strategies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cms" ON public.cabinet_marketing_strategies FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER cms_updated BEFORE UPDATE ON public.cabinet_marketing_strategies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.cabinet_roadmap (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done')),
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cabinet_roadmap TO authenticated;
GRANT ALL ON public.cabinet_roadmap TO service_role;
ALTER TABLE public.cabinet_roadmap ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roadmap" ON public.cabinet_roadmap FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER roadmap_updated BEFORE UPDATE ON public.cabinet_roadmap FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.cabinet_vision (
  user_id UUID PRIMARY KEY,
  vision_text TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cabinet_vision TO authenticated;
GRANT ALL ON public.cabinet_vision TO service_role;
ALTER TABLE public.cabinet_vision ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own vision" ON public.cabinet_vision FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER vision_updated BEFORE UPDATE ON public.cabinet_vision FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.cnss_config (
  user_id UUID PRIMARY KEY,
  total_due NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cnss_config TO authenticated;
GRANT ALL ON public.cnss_config TO service_role;
ALTER TABLE public.cnss_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cnss_config" ON public.cnss_config FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER cnss_config_updated BEFORE UPDATE ON public.cnss_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.cnss_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  paid_at DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cnss_payments TO authenticated;
GRANT ALL ON public.cnss_payments TO service_role;
ALTER TABLE public.cnss_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cnss_payments" ON public.cnss_payments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ PERSONAL ============
CREATE TABLE public.personal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('shopping','bad_habit','standard_self','standard_others','good_habit','islamic')),
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done')),
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_items TO authenticated;
GRANT ALL ON public.personal_items TO service_role;
ALTER TABLE public.personal_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own personal_items" ON public.personal_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER personal_items_updated BEFORE UPDATE ON public.personal_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ LEARNING ============
CREATE TABLE public.learning_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  resource_url TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done')),
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_items TO authenticated;
GRANT ALL ON public.learning_items TO service_role;
ALTER TABLE public.learning_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own learning_items" ON public.learning_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER learning_items_updated BEFORE UPDATE ON public.learning_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
