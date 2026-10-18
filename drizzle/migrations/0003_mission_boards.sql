CREATE TABLE public.life_mission (user_id uuid PRIMARY KEY, mission_text text NOT NULL DEFAULT '', updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.life_mission TO authenticated;
GRANT ALL ON public.life_mission TO service_role;
ALTER TABLE public.life_mission ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mission" ON public.life_mission FOR ALL TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

CREATE TABLE public.mission_boards (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 title text NOT NULL,
 display text NOT NULL DEFAULT 'list' CHECK (display IN ('list','table')),
 color text NOT NULL DEFAULT 'amber',
 items jsonb NOT NULL DEFAULT '[]'::jsonb,
 sort_order integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mission_boards TO authenticated;
GRANT ALL ON public.mission_boards TO service_role;
ALTER TABLE public.mission_boards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own boards" ON public.mission_boards FOR ALL TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);