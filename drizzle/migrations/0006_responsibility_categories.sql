ALTER TABLE public.responsibilities ADD COLUMN category text NOT NULL DEFAULT '';
ALTER TABLE public.responsibilities ADD CONSTRAINT responsibilities_category_length CHECK (char_length(category) <= 100);
CREATE INDEX responsibilities_user_category_idx ON public.responsibilities (user_id, category);