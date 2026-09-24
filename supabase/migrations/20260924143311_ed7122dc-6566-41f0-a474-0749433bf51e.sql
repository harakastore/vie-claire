CREATE TABLE public.block_recurring_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  block_key text NOT NULL,
  scheduled_time time,
  days_of_week integer[],
  color text NOT NULL DEFAULT 'violet',
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.block_recurring_tasks TO authenticated;
GRANT ALL ON public.block_recurring_tasks TO service_role;
ALTER TABLE public.block_recurring_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own block recurring" ON public.block_recurring_tasks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER block_recurring_updated BEFORE UPDATE ON public.block_recurring_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.block_recurring_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  task_id uuid NOT NULL REFERENCES public.block_recurring_tasks(id) ON DELETE CASCADE,
  day_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, day_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.block_recurring_logs TO authenticated;
GRANT ALL ON public.block_recurring_logs TO service_role;
ALTER TABLE public.block_recurring_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own block recurring logs" ON public.block_recurring_logs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);