ALTER TABLE public.weekly_sports ADD COLUMN kcal_logged boolean NOT NULL DEFAULT false;
UPDATE public.weekly_sports SET kcal_logged = true WHERE COALESCE(kcal_eaten,0) > 0 OR COALESCE(kcal_burned,0) > 0;
CREATE OR REPLACE FUNCTION public.mark_calorie_entry() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP = 'UPDATE' AND (NEW.kcal_eaten IS DISTINCT FROM OLD.kcal_eaten OR NEW.kcal_burned IS DISTINCT FROM OLD.kcal_burned) THEN NEW.kcal_logged := true;
 ELSIF TG_OP = 'INSERT' AND (COALESCE(NEW.kcal_eaten,0)>0 OR COALESCE(NEW.kcal_burned,0)>0) THEN NEW.kcal_logged := true;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER mark_calorie_entry BEFORE INSERT OR UPDATE ON public.weekly_sports FOR EACH ROW EXECUTE FUNCTION public.mark_calorie_entry();