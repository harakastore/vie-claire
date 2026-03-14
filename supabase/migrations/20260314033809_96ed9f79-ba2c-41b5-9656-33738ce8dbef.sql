
CREATE TABLE public.weekly_sports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  week_start date NOT NULL,
  day_index integer NOT NULL CHECK (day_index >= 0 AND day_index <= 6),
  program text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, week_start, day_index)
);

ALTER TABLE public.weekly_sports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own weekly_sports" ON public.weekly_sports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own weekly_sports" ON public.weekly_sports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own weekly_sports" ON public.weekly_sports FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own weekly_sports" ON public.weekly_sports FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.daily_habit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  habit_id uuid NOT NULL REFERENCES public.daily_habits(id) ON DELETE CASCADE,
  day_date date NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, habit_id, day_date)
);

ALTER TABLE public.daily_habit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own daily_habit_logs" ON public.daily_habit_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own daily_habit_logs" ON public.daily_habit_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own daily_habit_logs" ON public.daily_habit_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own daily_habit_logs" ON public.daily_habit_logs FOR DELETE USING (auth.uid() = user_id);
