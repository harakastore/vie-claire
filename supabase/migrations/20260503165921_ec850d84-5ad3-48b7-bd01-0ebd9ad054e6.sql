
-- 1. Priorité sur tâches quotidiennes
ALTER TABLE public.daily_tasks
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- 2. Heure de sport
ALTER TABLE public.weekly_sports
  ADD COLUMN IF NOT EXISTS sport_time time;

-- 3. Repas
CREATE TABLE IF NOT EXISTS public.meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  day_date date NOT NULL,
  meal_type text NOT NULL, -- petit_dej | dej | collation | diner
  completed boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own meals" ON public.meals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own meals" ON public.meals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own meals" ON public.meals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own meals" ON public.meals FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_meals_updated_at BEFORE UPDATE ON public.meals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_meals_user_day ON public.meals(user_id, day_date);

-- 4. Items des repas
CREATE TABLE IF NOT EXISTS public.meal_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  meal_id uuid NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
  name text NOT NULL,
  kcal numeric NOT NULL DEFAULT 0,
  protein_g numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.meal_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own meal_items" ON public.meal_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own meal_items" ON public.meal_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own meal_items" ON public.meal_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own meal_items" ON public.meal_items FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_meal_items_meal ON public.meal_items(meal_id);

-- 5. Logs de poids
CREATE TABLE IF NOT EXISTS public.weight_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  log_date date NOT NULL,
  weight_kg numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, log_date)
);
ALTER TABLE public.weight_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own weight_logs" ON public.weight_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own weight_logs" ON public.weight_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own weight_logs" ON public.weight_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own weight_logs" ON public.weight_logs FOR DELETE USING (auth.uid() = user_id);

-- 6. Objectif poids (un seul actif)
CREATE TABLE IF NOT EXISTS public.weight_goal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  start_weight_kg numeric NOT NULL,
  target_weight_kg numeric NOT NULL,
  start_date date NOT NULL,
  target_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.weight_goal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own weight_goal" ON public.weight_goal FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own weight_goal" ON public.weight_goal FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own weight_goal" ON public.weight_goal FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own weight_goal" ON public.weight_goal FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_weight_goal_updated_at BEFORE UPDATE ON public.weight_goal FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
