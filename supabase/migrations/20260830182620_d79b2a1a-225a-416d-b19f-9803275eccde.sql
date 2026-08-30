CREATE TABLE public.routine_meals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  slot text NOT NULL,
  name text NOT NULL,
  kcal numeric,
  protein_g numeric,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.routine_meals TO authenticated;
GRANT ALL ON public.routine_meals TO service_role;
ALTER TABLE public.routine_meals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own routine meals" ON public.routine_meals FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_routine_meals_updated_at BEFORE UPDATE ON public.routine_meals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.routine_schedule (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  label text NOT NULL,
  start_time time without time zone,
  end_time time without time zone,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.routine_schedule TO authenticated;
GRANT ALL ON public.routine_schedule TO service_role;
ALTER TABLE public.routine_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own routine schedule" ON public.routine_schedule FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_routine_schedule_updated_at BEFORE UPDATE ON public.routine_schedule FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();