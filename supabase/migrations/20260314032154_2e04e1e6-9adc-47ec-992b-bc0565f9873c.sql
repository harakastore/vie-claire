CREATE TABLE public.daily_habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_habits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own daily_habits" ON public.daily_habits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own daily_habits" ON public.daily_habits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own daily_habits" ON public.daily_habits FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own daily_habits" ON public.daily_habits FOR DELETE USING (auth.uid() = user_id);