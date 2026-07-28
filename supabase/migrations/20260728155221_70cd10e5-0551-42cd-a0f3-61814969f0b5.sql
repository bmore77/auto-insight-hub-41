CREATE TABLE public.snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date date NOT NULL,
  period_label text NOT NULL DEFAULT '',
  source_view text NOT NULL DEFAULT 'store',
  image_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.snapshots TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.snapshots TO authenticated;
GRANT ALL ON public.snapshots TO service_role;

ALTER TABLE public.snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read snapshots" ON public.snapshots FOR SELECT USING (true);
CREATE POLICY "Anyone can create snapshots" ON public.snapshots FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update snapshots" ON public.snapshots FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete snapshots" ON public.snapshots FOR DELETE USING (true);

CREATE TABLE public.snapshot_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL REFERENCES public.snapshots(id) ON DELETE CASCADE,
  dealership_id text NOT NULL,
  source_name text NOT NULL DEFAULT '',
  leads numeric,
  leads_prev numeric,
  sales numeric,
  sales_prev numeric,
  ad_spend numeric,
  ad_spend_prev numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (snapshot_id, dealership_id)
);

CREATE INDEX snapshot_metrics_snapshot_id_idx ON public.snapshot_metrics (snapshot_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.snapshot_metrics TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.snapshot_metrics TO authenticated;
GRANT ALL ON public.snapshot_metrics TO service_role;

ALTER TABLE public.snapshot_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read snapshot metrics" ON public.snapshot_metrics FOR SELECT USING (true);
CREATE POLICY "Anyone can create snapshot metrics" ON public.snapshot_metrics FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update snapshot metrics" ON public.snapshot_metrics FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete snapshot metrics" ON public.snapshot_metrics FOR DELETE USING (true);

CREATE TRIGGER set_snapshots_updated_at BEFORE UPDATE ON public.snapshots
FOR EACH ROW EXECUTE FUNCTION public.set_action_plans_updated_at();

CREATE TRIGGER set_snapshot_metrics_updated_at BEFORE UPDATE ON public.snapshot_metrics
FOR EACH ROW EXECUTE FUNCTION public.set_action_plans_updated_at();