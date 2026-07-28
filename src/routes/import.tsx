import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Eye,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

import { ROSTER, formatCurrency } from "@/lib/dealerships";
import { fuzzySuggest, normalizeName, resolveName, setAlias, useMapping } from "@/lib/mapping";
import {
  createSnapshot,
  deleteSnapshot,
  listMetrics,
  listSnapshots,
  replaceSnapshotMetrics,
  screenshotUrl,
  setSelectedSnapshotId,
  setSnapshotStatus,
  uploadScreenshot,
  type Snapshot,
} from "@/lib/snapshots";
import { parseScreenshots, type ParsedTable } from "@/lib/screenshot-parse.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/import")({
  head: () => ({
    meta: [
      { title: "Import Screenshot Data — Auto Canada" },
      {
        name: "description",
        content:
          "Upload a Tableau screenshot, review the extracted dealership numbers, and save it as a dated snapshot the dashboard can rank.",
      },
      { property: "og:title", content: "Import Screenshot Data — Auto Canada" },
      {
        property: "og:description",
        content:
          "Turn a daily Tableau screenshot into structured dealership metrics with review and date-range history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ImportPage,
});

type MetricKey = "leads" | "sales" | "adSpend" | "closeRate" | "unknown";

type ReviewRow = {
  dealershipId: string;
  name: string;
  sourceName: string;
  leads: number | null;
  leadsPrev: number | null;
  sales: number | null;
  salesPrev: number | null;
  adSpend: number | null;
  adSpendPrev: number | null;
  closeRate: number | null;
  lowConfidence: boolean;
};

type UnmatchedRow = {
  key: string;
  metric: MetricKey;
  name: string;
  current: number | null;
  previous: number | null;
};

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const METRIC_LABEL: Record<MetricKey, string> = {
  leads: "Leads",
  sales: "Sales",
  adSpend: "Ad spend",
  closeRate: "Close rate",
  unknown: "Unclassified",
};

function ImportPage() {
  const [mapping] = useMapping();

  const [files, setFiles] = useState<File[]>([]);
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [periodLabel, setPeriodLabel] = useState("");
  const [sourceView, setSourceView] = useState("store");
  const [notes, setNotes] = useState("");

  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tables, setTables] = useState<ParsedTable[]>([]);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [unmatched, setUnmatched] = useState<UnmatchedRow[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const parse = useServerFn(parseScreenshots);

  const refreshHistory = useCallback(async () => {
    try {
      const snaps = await listSnapshots();
      setSnapshots(snaps);
      const metrics = await listMetrics(snaps.map((s) => s.id));
      const c: Record<string, number> = {};
      for (const m of metrics) c[m.snapshotId] = (c[m.snapshotId] ?? 0) + 1;
      setCounts(c);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  /* ---------------- reconciliation ---------------- */

  const canonicalIndex = useMemo(() => {
    const byName = new Map<string, { id: string; name: string }>();
    for (const d of ROSTER) byName.set(normalizeName(d.name), { id: d.id, name: d.name });
    return byName;
  }, []);
  const canonicalNames = useMemo(() => ROSTER.map((d) => d.name), []);

  const matchStore = useCallback(
    (raw: string) => {
      const viaMapping = resolveName(raw, mapping);
      const exact = canonicalIndex.get(normalizeName(viaMapping));
      if (exact) return exact;
      const [best] = fuzzySuggest(viaMapping, canonicalNames, 1);
      if (best && best.score >= 0.62) {
        return canonicalIndex.get(normalizeName(best.name)) ?? null;
      }
      return null;
    },
    [mapping, canonicalIndex, canonicalNames],
  );

  const buildReview = useCallback(
    (parsedTables: ParsedTable[]) => {
      const byStore = new Map<string, ReviewRow>();
      const misses: UnmatchedRow[] = [];

      for (const t of parsedTables) {
        const metric = t.metric as MetricKey;
        for (const [i, r] of t.rows.entries()) {
          const hit = matchStore(r.name);
          if (!hit) {
            misses.push({
              key: `${metric}-${i}-${r.name}`,
              metric,
              name: r.name,
              current: r.current,
              previous: r.previous,
            });
            continue;
          }
          const row =
            byStore.get(hit.id) ??
            ({
              dealershipId: hit.id,
              name: hit.name,
              sourceName: r.name,
              leads: null,
              leadsPrev: null,
              sales: null,
              salesPrev: null,
              adSpend: null,
              adSpendPrev: null,
              closeRate: null,
              lowConfidence: false,
            } as ReviewRow);
          if (r.confidence === "low") row.lowConfidence = true;
          if (metric === "leads") {
            row.leads = r.current;
            row.leadsPrev = r.previous;
          } else if (metric === "sales") {
            row.sales = r.current;
            row.salesPrev = r.previous;
          } else if (metric === "adSpend") {
            row.adSpend = r.current;
            row.adSpendPrev = r.previous;
          } else if (metric === "closeRate") {
            row.closeRate = r.current;
          }
          byStore.set(hit.id, row);
        }
      }

      setRows(
        Array.from(byStore.values()).sort((a, b) => a.name.localeCompare(b.name)),
      );
      setUnmatched(misses);
    },
    [matchStore],
  );

  // Re-run matching when the user adds a mapping alias.
  useEffect(() => {
    if (tables.length > 0) buildReview(tables);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapping]);

  /* ---------------- actions ---------------- */

  const runParse = async () => {
    if (files.length === 0) {
      toast.error("Add at least one screenshot first.");
      return;
    }
    setParsing(true);
    try {
      const images = await Promise.all(files.map(fileToDataUrl));
      const result = await parse({ data: { images } });
      setTables(result.tables);
      setWarnings(result.warnings ?? []);
      buildReview(result.tables);
      if (result.periodLabel && !periodLabel) setPeriodLabel(result.periodLabel);
      const total = result.tables.reduce((s, t) => s + t.rows.length, 0);
      toast.success(`Read ${total} rows across ${result.tables.length} tables.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setParsing(false);
    }
  };

  const editCell = (id: string, key: keyof ReviewRow, value: string) => {
    const num = value.trim() === "" ? null : Number(value.replace(/[^0-9.-]/g, ""));
    setRows((prev) =>
      prev.map((r) =>
        r.dealershipId === id
          ? { ...r, [key]: Number.isFinite(num as number) ? num : null }
          : r,
      ),
    );
  };

  const dropRow = (id: string) =>
    setRows((prev) => prev.filter((r) => r.dealershipId !== id));

  const mapUnmatched = (row: UnmatchedRow, canonical: string) => {
    setAlias(row.name, canonical);
    toast.success(`"${row.name}" → ${canonical}`);
  };

  const publish = async () => {
    if (rows.length === 0) {
      toast.error("Nothing to save — parse a screenshot first.");
      return;
    }
    setSaving(true);
    try {
      const paths: string[] = [];
      for (const f of files) paths.push(await uploadScreenshot(f));

      // Replace any snapshot already saved for this date + view.
      const existing = snapshots.find(
        (s) => s.reportDate === reportDate && s.sourceView === sourceView,
      );
      if (existing) await deleteSnapshot(existing.id);

      const snap = await createSnapshot({
        reportDate,
        periodLabel,
        sourceView,
        imagePaths: paths,
        notes,
      });
      await replaceSnapshotMetrics(
        snap.id,
        rows.map((r) => ({
          dealershipId: r.dealershipId,
          sourceName: r.sourceName,
          leads: r.leads,
          leadsPrev: r.leadsPrev,
          sales: r.sales,
          salesPrev: r.salesPrev,
          adSpend: r.adSpend,
          adSpendPrev: r.adSpendPrev,
        })),
      );
      await setSnapshotStatus(snap.id, "published");
      setSelectedSnapshotId(snap.id);
      toast.success(`Snapshot for ${fmtDate(reportDate)} published to the dashboard.`);
      setFiles([]);
      setRows([]);
      setUnmatched([]);
      setTables([]);
      setWarnings([]);
      await refreshHistory();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const viewImage = async (path: string) => {
    const url = await screenshotUrl(path);
    if (url) window.open(url, "_blank", "noopener");
    else toast.error("Could not open that screenshot.");
  };

  const toggleStatus = async (s: Snapshot) => {
    await setSnapshotStatus(s.id, s.status === "published" ? "draft" : "published");
    await refreshHistory();
  };

  const removeSnapshot = async (s: Snapshot) => {
    await deleteSnapshot(s.id);
    toast.success("Snapshot deleted.");
    await refreshHistory();
  };

  /* ---------------- derived checks ---------------- */

  const issues = useMemo(() => {
    const out: string[] = [];
    const missingLeads = rows.filter((r) => r.leads == null).length;
    if (missingLeads) out.push(`${missingLeads} stores have no leads value.`);
    const mismatch = rows.filter((r) => {
      if (r.closeRate == null || !r.leads || r.sales == null) return false;
      const implied = (r.sales / r.leads) * 100;
      return Math.abs(implied - r.closeRate) > 1.5;
    }).length;
    if (mismatch)
      out.push(`${mismatch} stores where sales ÷ leads doesn't match the printed close rate.`);
    return out;
  }, [rows]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-8 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background text-sm font-semibold">
              A
            </div>
            <div>
              <div className="text-sm font-medium tracking-tight">Auto Canada</div>
              <div className="text-xs text-muted-foreground">Screenshot import</div>
            </div>
          </div>
          <nav className="flex items-center gap-1 text-sm">
            <Link to="/" className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              Dashboard
            </Link>
            <Link to="/priority" className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              Priority
            </Link>
            <Link to="/data" className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              Data
            </Link>
            <Link to="/import" className="rounded-md bg-muted px-3 py-1.5 text-foreground">
              Import
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-8 px-8 py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Import screenshot data</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Drop today's Tableau screenshots, review what was read, and publish it as a
            dated snapshot. Every dashboard view can then switch between saved dates.
          </p>
        </div>

        {/* Upload */}
        <section className="rounded-xl border border-border/60 p-6">
          <div className="grid gap-5 md:grid-cols-[1.4fr_1fr]">
            <div>
              <label
                htmlFor="shots"
                className="flex h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 text-sm text-muted-foreground transition-colors hover:bg-muted/60"
              >
                <Upload className="h-5 w-5" />
                <span>Click to add screenshots (PNG / JPG)</span>
                <span className="text-xs">Multiple crops from the same day are fine</span>
              </label>
              <input
                id="shots"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              />
              {previews.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {previews.map((p, i) => (
                    <img
                      key={p}
                      src={p}
                      alt={`Screenshot ${i + 1} to import`}
                      className="h-20 rounded-md border border-border/60 object-cover"
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">Report date</div>
                <Input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="h-9"
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">Period label</div>
                <Input
                  placeholder="e.g. Jul 1 – Jul 28"
                  value={periodLabel}
                  onChange={(e) => setPeriodLabel(e.target.value)}
                  className="h-9"
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">Source view</div>
                <Select value={sourceView} onValueChange={setSourceView}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="store">By store</SelectItem>
                    <SelectItem value="lead_source">By lead source</SelectItem>
                    <SelectItem value="inventory">By inventory type</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={runParse} disabled={parsing} className="w-full">
                {parsing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reading screenshots…
                  </>
                ) : (
                  "Parse screenshots"
                )}
              </Button>
            </div>
          </div>
        </section>

        {warnings.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-700">
            {warnings.map((w) => (
              <div key={w} className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {/* Unmatched */}
        {unmatched.length > 0 && (
          <section className="rounded-xl border border-border/60 p-6">
            <h2 className="text-sm font-semibold">
              Unmatched store names ({unmatched.length})
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              These names couldn't be tied to a dealership. Pick the right store — the alias
              is saved so future imports match automatically.
            </p>
            <div className="mt-4 space-y-2">
              {unmatched.map((u) => {
                const suggestions = fuzzySuggest(u.name, canonicalNames, 3);
                return (
                  <div
                    key={u.key}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{u.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {METRIC_LABEL[u.metric]} · {u.current ?? "—"} vs {u.previous ?? "—"}
                    </span>
                    <div className="ml-auto flex flex-wrap items-center gap-2">
                      {suggestions.map((s) => (
                        <button
                          key={s.name}
                          onClick={() => mapUnmatched(u, s.name)}
                          className="rounded-full border border-border/60 px-2.5 py-1 text-xs transition-colors hover:bg-muted"
                        >
                          {s.name} · {(s.score * 100).toFixed(0)}%
                        </button>
                      ))}
                      <Select onValueChange={(v) => mapUnmatched(u, v)}>
                        <SelectTrigger className="h-8 w-[200px] text-xs">
                          <SelectValue placeholder="Map to dealership" />
                        </SelectTrigger>
                        <SelectContent>
                          {canonicalNames.map((n) => (
                            <SelectItem key={n} value={n}>
                              {n}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Review grid */}
        {rows.length > 0 && (
          <section className="rounded-xl border border-border/60">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-6 py-4">
              <div>
                <h2 className="text-sm font-semibold">Review ({rows.length} stores)</h2>
                <p className="text-xs text-muted-foreground">
                  Edit any cell before publishing. Blank values fall back to the store's last
                  known number.
                </p>
              </div>
              <Button onClick={publish} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" /> Publish snapshot
                  </>
                )}
              </Button>
            </div>

            {issues.length > 0 && (
              <div className="border-b border-border/60 bg-amber-500/5 px-6 py-3 text-xs text-amber-700">
                {issues.map((i) => (
                  <div key={i}>• {i}</div>
                ))}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border/60">
                    <th className="px-6 py-2 text-left font-medium">Store</th>
                    <th className="px-3 py-2 text-right font-medium">Leads</th>
                    <th className="px-3 py-2 text-right font-medium">Leads prev</th>
                    <th className="px-3 py-2 text-right font-medium">Sales</th>
                    <th className="px-3 py-2 text-right font-medium">Sales prev</th>
                    <th className="px-3 py-2 text-right font-medium">Ad spend</th>
                    <th className="px-3 py-2 text-right font-medium">Spend prev</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.dealershipId}
                      className={cn(
                        "border-b border-border/40",
                        r.lowConfidence && "bg-amber-500/5",
                      )}
                    >
                      <td className="px-6 py-2">
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-muted-foreground">
                          read as “{r.sourceName}”
                          {r.closeRate != null && ` · close ${r.closeRate}%`}
                        </div>
                      </td>
                      {(
                        [
                          "leads",
                          "leadsPrev",
                          "sales",
                          "salesPrev",
                          "adSpend",
                          "adSpendPrev",
                        ] as const
                      ).map((k) => (
                        <td key={k} className="px-3 py-2 text-right">
                          <Input
                            value={r[k] ?? ""}
                            onChange={(e) => editCell(r.dealershipId, k, e.target.value)}
                            className="h-8 w-24 text-right text-sm"
                            inputMode="decimal"
                          />
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => dropRow(r.dealershipId)}
                          className="text-muted-foreground transition-colors hover:text-destructive"
                          aria-label={`Remove ${r.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-border/60 px-6 py-4">
              <div className="mb-1 text-xs font-medium text-muted-foreground">Notes</div>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything worth remembering about this import…"
                className="min-h-[70px]"
              />
            </div>
          </section>
        )}

        {/* History */}
        <section className="rounded-xl border border-border/60">
          <div className="border-b border-border/60 px-6 py-4">
            <h2 className="text-sm font-semibold">Snapshot history</h2>
            <p className="text-xs text-muted-foreground">
              Published snapshots feed the dashboard date selector.
            </p>
          </div>
          {snapshots.length === 0 ? (
            <div className="px-6 py-8 text-sm text-muted-foreground">
              No snapshots yet — the dashboard is running on the built-in sample roster.
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {snapshots.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center gap-3 px-6 py-3 text-sm">
                  <div className="min-w-[180px]">
                    <div className="font-medium">{fmtDate(s.reportDate)}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.periodLabel || "No period label"} · {s.sourceView.replace("_", " ")}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {counts[s.id] ?? 0} stores
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-medium",
                      s.status === "published"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {s.status}
                  </span>
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    {s.imagePaths.map((p, i) => (
                      <Button
                        key={p}
                        variant="ghost"
                        size="sm"
                        onClick={() => viewImage(p)}
                        className="h-8 text-xs"
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" /> Image {i + 1}
                      </Button>
                    ))}
                    {s.status === "published" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => {
                          setSelectedSnapshotId(s.id);
                          toast.success("Dashboard now shows this snapshot.");
                        }}
                      >
                        Use for dashboard
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => void toggleStatus(s)}
                    >
                      {s.status === "published" ? "Unpublish" : "Publish"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-destructive"
                      onClick={() => void removeSnapshot(s)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <p className="pb-8 text-xs text-muted-foreground">
          When Tableau is connected live it can write into these same snapshot tables —
          the dashboard, scoring and history stay exactly as they are.
        </p>
      </main>
    </div>
  );
}
