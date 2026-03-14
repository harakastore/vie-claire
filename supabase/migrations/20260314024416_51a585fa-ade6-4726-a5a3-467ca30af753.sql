
-- 1. Revenues table
CREATE TABLE public.revenues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  category text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.revenues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own revenues" ON public.revenues FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own revenues" ON public.revenues FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own revenues" ON public.revenues FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own revenues" ON public.revenues FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_revenues_updated_at BEFORE UPDATE ON public.revenues FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. Goals table
CREATE TABLE public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT '90day',
  title text NOT NULL,
  status text NOT NULL DEFAULT 'todo',
  progress integer NOT NULL DEFAULT 0,
  month integer,
  year integer,
  week_start date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own goals" ON public.goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own goals" ON public.goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goals" ON public.goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own goals" ON public.goals FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON public.goals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. Daily tasks table
CREATE TABLE public.daily_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  day_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.daily_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own daily_tasks" ON public.daily_tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own daily_tasks" ON public.daily_tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own daily_tasks" ON public.daily_tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own daily_tasks" ON public.daily_tasks FOR DELETE USING (auth.uid() = user_id);

-- 4. Modify credits table for personal debts
ALTER TABLE public.credits ADD COLUMN IF NOT EXISTS person_name text;
ALTER TABLE public.credits ADD COLUMN IF NOT EXISTS credit_type text NOT NULL DEFAULT 'they_owe';
ALTER TABLE public.credits ADD COLUMN IF NOT EXISTS amount numeric;
ALTER TABLE public.credits ADD COLUMN IF NOT EXISTS credit_date date;
UPDATE public.credits SET person_name = COALESCE(lender, name), amount = total_amount, credit_date = start_date WHERE person_name IS NULL;
ALTER TABLE public.credits ALTER COLUMN lender DROP NOT NULL;
ALTER TABLE public.credits ALTER COLUMN total_amount DROP NOT NULL;
ALTER TABLE public.credits ALTER COLUMN monthly_payment DROP NOT NULL;
ALTER TABLE public.credits ALTER COLUMN start_date DROP NOT NULL;
ALTER TABLE public.credits ALTER COLUMN end_date DROP NOT NULL;
ALTER TABLE public.credits ALTER COLUMN name DROP NOT NULL;

-- 5. Modify payments table
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS supplier_name text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS invoice_count integer DEFAULT 0;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.payments ALTER COLUMN supplier_id DROP NOT NULL;
