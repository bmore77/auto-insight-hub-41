CREATE TABLE public.action_plans (
  dealership_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'not_started',
  owner TEXT NOT NULL DEFAULT '',
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  score_when_ranked NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_plans TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_plans TO authenticated;
GRANT ALL ON public.action_plans TO service_role;

ALTER TABLE public.action_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read action plans" ON public.action_plans FOR SELECT USING (true);
CREATE POLICY "Anyone can create action plans" ON public.action_plans FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update action plans" ON public.action_plans FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete action plans" ON public.action_plans FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.set_action_plans_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER action_plans_updated_at BEFORE UPDATE ON public.action_plans
FOR EACH ROW EXECUTE FUNCTION public.set_action_plans_updated_at();