/**
 * Dated data snapshots imported from Tableau screenshots.
 * Stored in Lovable Cloud so the dashboard can be driven by real numbers
 * (with date-range selection) until a live Tableau connection exists.
 */
import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import {
  buildDealershipsFromMetrics,
  computeMetrics,
  type DealershipMetrics,
  type MetricInput,
} from "@/lib/dealerships";

export const SCREENSHOT_BUCKET = "tableau-screenshots";

export type SnapshotStatus = "draft" | "published";

export type Snapshot = {
  id: string;
  reportDate: string; // yyyy-mm-dd
  periodLabel: string;
  sourceView: string;
  imagePaths: string[];
  status: SnapshotStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type SnapshotMetric = MetricInput & {
  id?: string;
  snapshotId: string;
  sourceName: string;
};

type SnapshotRow = {
  id: string;
  report_date: string;
  period_label: string;
  source_view: string;
  image_paths: unknown;
  status: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

type MetricRow = {
  id: string;
  snapshot_id: string;
  dealership_id: string;
  source_name: string;
  leads: number | null;
  leads_prev: number | null;
  sales: number | null;
  sales_prev: number | null;
  ad_spend: number | null;
  ad_spend_prev: number | null;
};

const toSnapshot = (r: SnapshotRow): Snapshot => ({
  id: r.id,
  reportDate: r.report_date,
  periodLabel: r.period_label ?? "",
  sourceView: r.source_view ?? "store",
  imagePaths: Array.isArray(r.image_paths) ? (r.image_paths as string[]) : [],
  status: r.status === "published" ? "published" : "draft",
  notes: r.notes ?? "",
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toMetric = (r: MetricRow): SnapshotMetric => ({
  id: r.id,
  snapshotId: r.snapshot_id,
  dealershipId: r.dealership_id,
  sourceName: r.source_name ?? "",
  leads: r.leads,
  leadsPrev: r.leads_prev,
  sales: r.sales,
  salesPrev: r.sales_prev,
  adSpend: r.ad_spend,
  adSpendPrev: r.ad_spend_prev,
});

/* ---------------- storage ---------------- */

export async function uploadScreenshot(file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "png";
  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(SCREENSHOT_BUCKET)
    .upload(path, file, { contentType: file.type || "image/png" });
  if (error) throw error;
  return path;
}

export async function screenshotUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage
    .from(SCREENSHOT_BUCKET)
    .createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

/* ---------------- crud ---------------- */

export async function listSnapshots(): Promise<Snapshot[]> {
  const { data, error } = await supabase
    .from("snapshots")
    .select("*")
    .order("report_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as SnapshotRow[]).map(toSnapshot);
}

export async function listMetrics(snapshotIds?: string[]): Promise<SnapshotMetric[]> {
  let q = supabase.from("snapshot_metrics").select("*");
  if (snapshotIds) {
    if (snapshotIds.length === 0) return [];
    q = q.in("snapshot_id", snapshotIds);
  }
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as MetricRow[]).map(toMetric);
}

export async function createSnapshot(input: {
  reportDate: string;
  periodLabel: string;
  sourceView: string;
  imagePaths: string[];
  notes?: string;
}): Promise<Snapshot> {
  const { data, error } = await supabase
    .from("snapshots")
    .insert({
      report_date: input.reportDate,
      period_label: input.periodLabel,
      source_view: input.sourceView,
      image_paths: input.imagePaths as unknown as never,
      notes: input.notes ?? "",
      status: "draft",
    })
    .select("*")
    .single();
  if (error) throw error;
  return toSnapshot(data as SnapshotRow);
}

export async function replaceSnapshotMetrics(
  snapshotId: string,
  rows: Array<Omit<SnapshotMetric, "snapshotId" | "id">>,
) {
  const del = await supabase.from("snapshot_metrics").delete().eq("snapshot_id", snapshotId);
  if (del.error) throw del.error;
  if (rows.length === 0) return;
  const { error } = await supabase.from("snapshot_metrics").insert(
    rows.map((r) => ({
      snapshot_id: snapshotId,
      dealership_id: r.dealershipId,
      source_name: r.sourceName,
      leads: r.leads,
      leads_prev: r.leadsPrev,
      sales: r.sales,
      sales_prev: r.salesPrev,
      ad_spend: r.adSpend,
      ad_spend_prev: r.adSpendPrev,
    })),
  );
  if (error) throw error;
}

export async function setSnapshotStatus(id: string, status: SnapshotStatus) {
  const { error } = await supabase.from("snapshots").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function updateSnapshot(
  id: string,
  patch: Partial<Pick<Snapshot, "reportDate" | "periodLabel" | "notes" | "sourceView">>,
) {
  const { error } = await supabase
    .from("snapshots")
    .update({
      ...(patch.reportDate ? { report_date: patch.reportDate } : {}),
      ...(patch.periodLabel !== undefined ? { period_label: patch.periodLabel } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      ...(patch.sourceView ? { source_view: patch.sourceView } : {}),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteSnapshot(id: string) {
  const { error } = await supabase.from("snapshots").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------- selection (shared across pages) ---------------- */

const SELECTED_KEY = "ac.snapshot.selected.v1";
const SELECT_EVENT = "ac:snapshot:selected";

export const getSelectedSnapshotId = (): string | null => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(SELECTED_KEY);
};

export const setSelectedSnapshotId = (id: string | null) => {
  if (typeof window === "undefined") return;
  if (id) window.localStorage.setItem(SELECTED_KEY, id);
  else window.localStorage.removeItem(SELECTED_KEY);
  window.dispatchEvent(new Event(SELECT_EVENT));
};

/* ---------------- dashboard data source ---------------- */

export type DashboardData = {
  metrics: DealershipMetrics[];
  /** "snapshot" = imported screenshot data, "embedded" = built-in sample roster. */
  source: "snapshot" | "embedded";
  snapshots: Snapshot[];
  selected: Snapshot | null;
  selectId: (id: string | null) => void;
  loading: boolean;
  reload: () => void;
};

const EMBEDDED = () => computeMetrics();

export function useDashboardData(): DashboardData {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [metricRows, setMetricRows] = useState<SnapshotMetric[]>([]);
  const [selectedId, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const sync = () => setSelected(getSelectedSnapshotId());
    sync();
    window.addEventListener(SELECT_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SELECT_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const snaps = (await listSnapshots()).filter((s) => s.status === "published");
        const rows = await listMetrics(snaps.map((s) => s.id));
        if (!alive) return;
        setSnapshots(snaps);
        setMetricRows(rows);
      } catch {
        if (alive) {
          setSnapshots([]);
          setMetricRows([]);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [tick]);

  const selected = useMemo(() => {
    if (snapshots.length === 0) return null;
    return snapshots.find((s) => s.id === selectedId) ?? snapshots[0];
  }, [snapshots, selectedId]);

  const metrics = useMemo(() => {
    if (!selected) return EMBEDDED();
    const rows = metricRows.filter((r) => r.snapshotId === selected.id);
    if (rows.length === 0) return EMBEDDED();

    // Real leads history across published snapshots (oldest -> newest).
    const ordered = [...snapshots].sort((a, b) =>
      a.reportDate.localeCompare(b.reportDate),
    );
    const trendById: Record<string, number[]> = {};
    for (const snap of ordered) {
      for (const r of metricRows) {
        if (r.snapshotId !== snap.id || r.leads == null) continue;
        (trendById[r.dealershipId] ??= []).push(r.leads);
      }
      if (snap.id === selected.id) break;
    }

    return computeMetrics(buildDealershipsFromMetrics(rows, trendById));
  }, [selected, metricRows, snapshots]);

  const selectId = useCallback((id: string | null) => setSelectedSnapshotId(id), []);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  return {
    metrics,
    source: selected && metrics.length > 0 && metricRows.some((r) => r.snapshotId === selected.id)
      ? "snapshot"
      : "embedded",
    snapshots,
    selected,
    selectId,
    loading,
    reload,
  };
}
