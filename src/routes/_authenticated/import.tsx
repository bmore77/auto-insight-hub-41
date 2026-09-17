import { createFileRoute, Link } from "@tanstack/react-router";
import acLogo from "@/assets/auto-canada.webp.asset.json";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Eye, Loader2, Merge, Trash2, Upload } from "lucide-react";

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

import { ROSTER } from "@/lib/dealerships";
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
import { parseScreenshot, type ParsedTable } from "@/lib/screenshot-parse.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/import")({
  head: () => ({
    meta: [
      { title: "Import Screenshot Data — Auto Canada" },
      {
        name: "description",
        content:
          "Bulk upload Tableau screenshots, review confidence-scored dealership numbers, and publish them as dated snapshots.",
      },
      { property: "og:title", content: "Import Screenshot Data — Auto Canada" },
      {
        property: "og:description",
        content:
          "Turn daily Tableau screenshots into structured dealership metrics with confidence scoring and date-range history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ImportPage,
});

type MetricKey = "leads" | "sales" | "adSpend" | "closeRate" | "unknown";

type MetricField =
  | "leads"
  | "leadsPrev"
  | "sales"
  | "salesPrev"
  | "adSpend"
  | "adSpendPrev"
  | "closeRate";

type MatchCandidate = { id: string; name: string; score: number };

type ReviewRow = {
  /** Stable per-row key (a store can appear more than once before merging). */
  rowId: string;
  dealershipId: string;
  name: string;
  sourceName: string;
  /** Every raw name that folded into this row (after merges). */
  sourceNames: string[];
  leads: number | null;
  leadsPrev: number | null;
  sales: number | null;
  salesPrev: number | null;
  adSpend: number | null;
  adSpendPrev: number | null;
  closeRate: number | null;
  /** 0–100 average confidence across every metric read for this store. */
  confidence: number;
  /** How sure we are the raw name maps to this roster store (0–100). */
  matchScore: number;
  /** Other plausible roster stores for the raw name. */
  candidates: MatchCandidate[];
  /** Per-field confidence, used when merging duplicates. */
  fieldConf: Partial<Record<MetricField, number>>;
  warnings: string[];
};


type UnmatchedRow = {
  key: string;
  metric: MetricKey;
  name: string;
  current: number | null;
  previous: number | null;
  confidence: number;
  candidates: MatchCandidate[];
};

const METRIC_FIELDS: MetricField[] = [
  "leads",
  "leadsPrev",
  "sales",
  "salesPrev",
  "adSpend",
  "adSpendPrev",
  "closeRate",
];

/** Fold rows that resolved to the same store, keeping the highest-confidence value per metric. */
const mergeDuplicateRows = (rows: ReviewRow[]): ReviewRow[] => {
  const byId = new Map<string, ReviewRow>();
  for (const row of rows) {
    const existing = byId.get(row.dealershipId);
    if (!existing) {
      byId.set(row.dealershipId, { ...row, fieldConf: { ...row.fieldConf } });
      continue;
    }
    const merged: ReviewRow = {
      ...existing,
      sourceNames: Array.from(new Set([...existing.sourceNames, ...row.sourceNames])),
      warnings: Array.from(new Set([...existing.warnings, ...row.warnings])),
      matchScore: Math.max(existing.matchScore, row.matchScore),
      confidence: Math.round((existing.confidence + row.confidence) / 2),
      fieldConf: { ...existing.fieldConf },
    };
    for (const f of METRIC_FIELDS) {
      const incoming = row[f];
      if (incoming == null) continue;
      const currentConf = merged.fieldConf[f] ?? (merged[f] == null ? -1 : merged.confidence);
      const incomingConf = row.fieldConf[f] ?? row.confidence;
      if (merged[f] == null || incomingConf > currentConf) {
        (merged[f] as number | null) = incoming;
        merged.fieldConf[f] = incomingConf;
      }
    }
    merged.sourceName = merged.sourceNames.join(" + ");
    byId.set(row.dealershipId, merged);
  }
  return Array.from(byId.values()).sort(
    (a, b) => a.confidence - b.confidence || a.name.localeCompare(b.name),
  );
};

const duplicateIds = (rows: ReviewRow[]) => {
  const seen = new Map<string, number>();
  for (const r of rows) seen.set(r.dealershipId, (seen.get(r.dealershipId) ?? 0) + 1);
  return new Set(Array.from(seen).filter(([, n]) => n > 1).map(([id]) => id));
};


type QueueItem = {
  id: string;
  file: File;
  preview: string;
  status: "queued" | "parsing" | "done" | "error";
  error?: string;
};

type Draft = {
  key: string;
  reportDate: string;
  periodLabel: string;
  sourceView: string;
  notes: string;
  files: File[];
  previews: string[];
  tables: ParsedTable[];
  rows: ReviewRow[];
  unmatched: UnmatchedRow[];
  warnings: string[];
  dateDetected: boolean;
  saving: boolean;
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

const today = () => new Date().toISOString().slice(0, 10);

const METRIC_LABEL: Record<MetricKey, string> = {
  leads: "Leads",
  sales: "Sales",
  adSpend: "Ad spend",
  closeRate: "Close rate",
  unknown: "Unclassified",
};

const confTone = (c: number) =>
  c >= 85
    ? "bg-emerald-500/10 text-emerald-600"
    : c >= 70
      ? "bg-amber-500/10 text-amber-700"
      : "bg-destructive/10 text-destructive";

function ConfidenceBadge({ value, warnings }: { value: number; warnings: string[] }) {
  return (
    <span
      title={warnings.length ? warnings.join("\n") : "No parsing warnings"}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        confTone(value),
      )}
    >
      {warnings.length > 0 && <AlertTriangle className="h-3 w-3" />}
      {value}%
    </span>
  );
}

function ImportPage() {
  const [mapping] = useMapping();

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [parsing, setParsing] = useState(false);
  const [fallbackDate, setFallbackDate] = useState(today);
  const [sourceView, setSourceView] = useState("store");

  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const parseOne = useServerFn(parseScreenshot);

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

  const addFiles = (list: FileList | null) => {
    const incoming = Array.from(list ?? []);
    if (incoming.length === 0) return;
    setQueue((prev) => [
      ...prev,
      ...incoming.map((file) => ({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
        status: "queued" as const,
      })),
    ]);
  };

  const removeQueued = (id: string) =>
    setQueue((prev) => {
      const hit = prev.find((q) => q.id === id);
      if (hit) URL.revokeObjectURL(hit.preview);
      return prev.filter((q) => q.id !== id);
    });

  /* ---------------- reconciliation ---------------- */

  const canonicalIndex = useMemo(() => {
    const byName = new Map<string, { id: string; name: string }>();
    for (const d of ROSTER) byName.set(normalizeName(d.name), { id: d.id, name: d.name });
    return byName;
  }, []);
  const canonicalNames = useMemo(() => ROSTER.map((d) => d.name), []);

  /** Returns the best match plus runner-up candidates for a raw name. */
  const matchStore = useCallback(
    (raw: string) => {
      const viaMapping = resolveName(raw, mapping);
      const suggestions = fuzzySuggest(viaMapping, canonicalNames, 5);
      const candidates: MatchCandidate[] = suggestions
        .map((s) => {
          const hit = canonicalIndex.get(normalizeName(s.name));
          return hit ? { id: hit.id, name: hit.name, score: Math.round(s.score * 100) } : null;
        })
        .filter((c): c is MatchCandidate => c !== null);

      const exact = canonicalIndex.get(normalizeName(viaMapping));
      if (exact) {
        return {
          hit: exact,
          matchScore: 100,
          candidates: candidates.filter((c) => c.id !== exact.id).slice(0, 3),
        };
      }
      const [best] = suggestions;
      if (best && best.score >= 0.62) {
        const hit = canonicalIndex.get(normalizeName(best.name));
        if (hit) {
          return {
            hit,
            matchScore: Math.round(best.score * 100),
            candidates: candidates.filter((c) => c.id !== hit.id).slice(0, 3),
          };
        }
      }
      return { hit: null, matchScore: 0, candidates: candidates.slice(0, 3) };
    },
    [mapping, canonicalIndex, canonicalNames],
  );

  const buildReview = useCallback(
    (parsedTables: ParsedTable[]) => {
      const byKey = new Map<string, ReviewRow & { _scores: number[] }>();
      const misses: UnmatchedRow[] = [];

      for (const t of parsedTables) {
        const metric = t.metric as MetricKey;
        for (const [i, r] of t.rows.entries()) {
          const { hit, matchScore, candidates } = matchStore(r.name);
          if (!hit) {
            misses.push({
              key: `${metric}-${i}-${r.name}`,
              metric,
              name: r.name,
              current: r.current,
              previous: r.previous,
              confidence: r.confidence,
              candidates,
            });
            continue;
          }
          const rowKey = `${hit.id}::${normalizeName(r.name)}`;
          const row =
            byKey.get(rowKey) ??
            ({
              rowId: rowKey,
              dealershipId: hit.id,
              name: hit.name,
              sourceName: r.name,
              sourceNames: [r.name],
              leads: null,
              leadsPrev: null,
              sales: null,
              salesPrev: null,
              adSpend: null,
              adSpendPrev: null,
              closeRate: null,
              confidence: 100,
              matchScore,
              candidates,
              fieldConf: {},
              warnings: [],
              _scores: [],
            } satisfies ReviewRow & { _scores: number[] });

          row._scores.push(r.confidence);
          for (const w of r.warnings) row.warnings.push(`${METRIC_LABEL[metric]}: ${w}`);

          const put = (field: MetricField, value: number | null) => {
            const prevConf = row.fieldConf[field];
            if (value == null) return;
            if (prevConf != null && prevConf >= r.confidence && row[field] != null) return;
            (row[field] as number | null) = value;
            row.fieldConf[field] = r.confidence;
          };

          if (metric === "leads") {
            put("leads", r.current);
            put("leadsPrev", r.previous);
          } else if (metric === "sales") {
            put("sales", r.current);
            put("salesPrev", r.previous);
          } else if (metric === "adSpend") {
            put("adSpend", r.current);
            put("adSpendPrev", r.previous);
          } else if (metric === "closeRate") {
            put("closeRate", r.current);
          }
          byKey.set(rowKey, row);
        }
      }

      const rows = Array.from(byKey.values())
        .map(({ _scores, ...row }) => ({
          ...row,
          confidence: _scores.length
            ? Math.round(_scores.reduce((a, b) => a + b, 0) / _scores.length)
            : 0,
        }))
        .sort((a, b) => a.confidence - b.confidence || a.name.localeCompare(b.name));

      return { rows, unmatched: misses };
    },
    [matchStore],
  );


  // Re-run matching whenever the user saves a new alias.
  useEffect(() => {
    setDrafts((prev) =>
      prev.map((d) => {
        const { rows, unmatched } = buildReview(d.tables);
        return { ...d, rows, unmatched };
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapping]);

  /* ---------------- bulk parse ---------------- */

  const runParse = async () => {
    const pending = queue.filter((q) => q.status !== "done");
    if (pending.length === 0) {
      toast.error("Add at least one screenshot first.");
      return;
    }
    setParsing(true);

    const grouped = new Map<
      string,
      {
        tables: ParsedTable[];
        warnings: string[];
        files: File[];
        previews: string[];
        periodLabel: string;
        dateDetected: boolean;
      }
    >();

    for (const item of pending) {
      setQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, status: "parsing" } : q)),
      );
      try {
        const image = await fileToDataUrl(item.file);
        const result = await parseOne({ data: { image } });
        const date = result.reportDate ?? fallbackDate;
        const bucket = grouped.get(date) ?? {
          tables: [],
          warnings: [],
          files: [],
          previews: [],
          periodLabel: "",
          dateDetected: Boolean(result.reportDate),
        };
        bucket.tables.push(...result.tables);
        bucket.warnings.push(
          ...result.warnings.map((w) => `${item.file.name}: ${w}`),
        );
        bucket.files.push(item.file);
        bucket.previews.push(item.preview);
        if (!bucket.periodLabel && result.periodLabel) bucket.periodLabel = result.periodLabel;
        if (result.reportDate) bucket.dateDetected = true;
        grouped.set(date, bucket);
        setQueue((prev) =>
          prev.map((q) => (q.id === item.id ? { ...q, status: "done" } : q)),
        );
      } catch (e) {
        const msg = (e as Error).message;
        setQueue((prev) =>
          prev.map((q) => (q.id === item.id ? { ...q, status: "error", error: msg } : q)),
        );
        toast.error(`${item.file.name}: ${msg}`);
      }
    }

    setDrafts((prev) => {
      const next = [...prev];
      for (const [date, bucket] of grouped) {
        const { rows, unmatched } = buildReview(bucket.tables);
        const existing = next.findIndex((d) => d.key === date);
        const draft: Draft = {
          key: date,
          reportDate: date,
          periodLabel: bucket.periodLabel,
          sourceView,
          notes: "",
          files: bucket.files,
          previews: bucket.previews,
          tables: bucket.tables,
          rows,
          unmatched,
          warnings: bucket.warnings,
          dateDetected: bucket.dateDetected,
          saving: false,
        };
        if (existing >= 0) {
          const merged = [...next[existing].tables, ...bucket.tables];
          const rebuilt = buildReview(merged);
          next[existing] = {
            ...next[existing],
            tables: merged,
            files: [...next[existing].files, ...bucket.files],
            previews: [...next[existing].previews, ...bucket.previews],
            warnings: [...next[existing].warnings, ...bucket.warnings],
            rows: rebuilt.rows,
            unmatched: rebuilt.unmatched,
          };
        } else {
          next.push(draft);
        }
      }
      return next.sort((a, b) => b.reportDate.localeCompare(a.reportDate));
    });

    setParsing(false);
    const dates = grouped.size;
    if (dates > 0) {
      toast.success(
        `Parsed ${pending.length} screenshot${pending.length > 1 ? "s" : ""} into ${dates} snapshot${dates > 1 ? "s" : ""}.`,
      );
    }
  };

  /* ---------------- draft editing ---------------- */

  const patchDraft = (key: string, patch: Partial<Draft>) =>
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  const editCell = (key: string, rowId: string, field: keyof ReviewRow, value: string) => {
    const num = value.trim() === "" ? null : Number(value.replace(/[^0-9.-]/g, ""));
    setDrafts((prev) =>
      prev.map((d) =>
        d.key === key
          ? {
              ...d,
              rows: d.rows.map((r) =>
                r.rowId === rowId
                  ? {
                      ...r,
                      [field]: Number.isFinite(num as number) ? num : null,
                      confidence: 100,
                      fieldConf: { ...r.fieldConf, [field]: 100 },
                      warnings: [],
                    }
                  : r,
              ),
            }
          : d,
      ),
    );
  };

  const dropRow = (key: string, rowId: string) =>
    setDrafts((prev) =>
      prev.map((d) => (d.key === key ? { ...d, rows: d.rows.filter((r) => r.rowId !== rowId) } : d)),
    );

  const discardDraft = (key: string) =>
    setDrafts((prev) => prev.filter((d) => d.key !== key));

  const mapUnmatched = (name: string, canonical: string) => {
    setAlias(name, canonical);
    toast.success(`"${name}" → ${canonical}`);
  };

  /** Re-point a matched row at a different roster store and remember the alias. */
  const reassignRow = (row: ReviewRow, canonical: string) => {
    for (const raw of row.sourceNames) setAlias(raw, canonical);
    toast.success(`"${row.sourceNames.join(" + ")}" → ${canonical}`);
  };

  /** Fold duplicate stores in a draft, keeping the highest-confidence value per metric. */
  const autoMerge = (key: string) => {
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.key !== key) return d;
        const before = d.rows.length;
        const rows = mergeDuplicateRows(d.rows);
        if (rows.length === before) {
          toast.info("No duplicate stores to merge.");
          return d;
        }
        toast.success(`Merged ${before - rows.length} duplicate row${before - rows.length > 1 ? "s" : ""}.`);
        return { ...d, rows };
      }),
    );
  };


  /* ---------------- publish ---------------- */

  const publishDraft = async (draft: Draft, quiet = false) => {
    if (draft.rows.length === 0) {
      toast.error(`${fmtDate(draft.reportDate)}: nothing to save.`);
      return false;
    }
    patchDraft(draft.key, { saving: true });
    try {
      const paths: string[] = [];
      for (const f of draft.files) paths.push(await uploadScreenshot(f));

      const existing = snapshots.find(
        (s) => s.reportDate === draft.reportDate && s.sourceView === draft.sourceView,
      );
      if (existing) await deleteSnapshot(existing.id);

      const snap = await createSnapshot({
        reportDate: draft.reportDate,
        periodLabel: draft.periodLabel,
        sourceView: draft.sourceView,
        imagePaths: paths,
        notes: draft.notes,
      });
      await replaceSnapshotMetrics(
        snap.id,
        draft.rows.map((r) => ({
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
      if (!quiet) toast.success(`Snapshot for ${fmtDate(draft.reportDate)} published.`);
      discardDraft(draft.key);
      setQueue((prev) => {
        prev.forEach((q) => {
          if (draft.files.includes(q.file)) URL.revokeObjectURL(q.preview);
        });
        return prev.filter((q) => !draft.files.includes(q.file));
      });
      await refreshHistory();
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      patchDraft(draft.key, { saving: false });
      return false;
    }
  };

  const publishAll = async () => {
    let ok = 0;
    for (const d of [...drafts]) {
      // eslint-disable-next-line no-await-in-loop
      if (await publishDraft(d, true)) ok += 1;
    }
    if (ok) toast.success(`Published ${ok} snapshot${ok > 1 ? "s" : ""}.`);
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

  const draftIssues = (d: Draft) => {
    const out: string[] = [];
    const missingLeads = d.rows.filter((r) => r.leads == null).length;
    if (missingLeads) out.push(`${missingLeads} stores have no leads value.`);
    const lowConf = d.rows.filter((r) => r.confidence < 70).length;
    if (lowConf) out.push(`${lowConf} low-confidence rows (under 70%) — verify before publishing.`);
    const mismatch = d.rows.filter((r) => {
      if (r.closeRate == null || !r.leads || r.sales == null) return false;
      const implied = (r.sales / r.leads) * 100;
      return Math.abs(implied - r.closeRate) > 1.5;
    }).length;
    if (mismatch)
      out.push(`${mismatch} stores where sales ÷ leads doesn't match the printed close rate.`);
    if (!d.dateDetected)
      out.push("No date was printed on these screenshots — confirm the report date.");
    return out;
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-8 py-5">
          <div className="flex items-center gap-3">
            <img src={acLogo.url} alt="AutoCanada" className="h-7 w-auto" />
            <div className="hidden h-6 w-px bg-border sm:block" />
            <div className="hidden text-xs text-muted-foreground sm:block">Screenshot import</div>
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
            Drop a batch of Tableau screenshots — each one is read on its own and grouped
            into a snapshot by the date printed on it. Review the confidence scores, fix
            anything flagged, then publish.
          </p>
        </div>

        {/* Upload */}
        <section className="rounded-xl border border-border/60 p-6">
          <div className="grid gap-5 md:grid-cols-[1.4fr_1fr]">
            <div>
              <label
                htmlFor="shots"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  addFiles(e.dataTransfer.files);
                }}
                className="flex h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 text-sm text-muted-foreground transition-colors hover:bg-muted/60"
              >
                <Upload className="h-5 w-5" />
                <span>Drop or click to add screenshots (PNG / JPG)</span>
                <span className="text-xs">
                  Multiple days at once — they're split into snapshots by date
                </span>
              </label>
              <input
                id="shots"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              {queue.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {queue.map((q) => (
                    <div key={q.id} className="relative">
                      <img
                        src={q.preview}
                        alt={`Screenshot ${q.file.name} queued for import`}
                        className={cn(
                          "h-20 rounded-md border border-border/60 object-cover",
                          q.status === "done" && "opacity-50",
                          q.status === "error" && "border-destructive",
                        )}
                      />
                      <div className="absolute inset-x-0 bottom-0 rounded-b-md bg-background/85 px-1 py-0.5 text-center text-[10px] text-muted-foreground">
                        {q.status === "parsing" ? "reading…" : q.status}
                      </div>
                      <button
                        onClick={() => removeQueued(q.id)}
                        aria-label={`Remove ${q.file.name}`}
                        className="absolute -right-1.5 -top-1.5 rounded-full border border-border bg-background p-0.5 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">
                  Fallback report date
                </div>
                <Input
                  type="date"
                  value={fallbackDate}
                  onChange={(e) => setFallbackDate(e.target.value)}
                  className="h-9"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Used only when no date is visible in a screenshot.
                </p>
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
                  `Parse ${queue.filter((q) => q.status !== "done").length || ""} screenshot${
                    queue.filter((q) => q.status !== "done").length === 1 ? "" : "s"
                  }`
                )}
              </Button>
            </div>
          </div>
        </section>

        {drafts.length > 1 && (
          <div className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3 text-sm">
            <span>
              {drafts.length} snapshots ready across{" "}
              {drafts.map((d) => fmtDate(d.reportDate)).join(", ")}
            </span>
            <Button size="sm" onClick={() => void publishAll()}>
              <Check className="mr-2 h-4 w-4" /> Publish all
            </Button>
          </div>
        )}

        {/* Draft snapshots */}
        {drafts.map((draft) => {
          const issues = draftIssues(draft);
          const dupIds = duplicateIds(draft.rows);
          return (
            <section key={draft.key} className="space-y-4 rounded-xl border border-border/60 p-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <div className="mb-1 text-xs font-medium text-muted-foreground">
                      Report date{" "}
                      {draft.dateDetected && (
                        <span className="text-emerald-600">· read from screenshot</span>
                      )}
                    </div>
                    <Input
                      type="date"
                      value={draft.reportDate}
                      onChange={(e) => patchDraft(draft.key, { reportDate: e.target.value })}
                      className="h-9 w-[170px]"
                    />
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-medium text-muted-foreground">
                      Period label
                    </div>
                    <Input
                      value={draft.periodLabel}
                      placeholder="e.g. Jul 1 – Jul 28"
                      onChange={(e) => patchDraft(draft.key, { periodLabel: e.target.value })}
                      className="h-9 w-[200px]"
                    />
                  </div>
                  <div className="pb-2 text-xs text-muted-foreground">
                    {draft.rows.length} stores · {draft.files.length} image
                    {draft.files.length > 1 ? "s" : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => discardDraft(draft.key)}
                    className="text-muted-foreground"
                  >
                    Discard
                  </Button>
                  <Button onClick={() => void publishDraft(draft)} disabled={draft.saving}>
                    {draft.saving ? (
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
              </div>

              {draft.previews.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {draft.previews.map((p, i) => (
                    <img
                      key={p}
                      src={p}
                      alt={`Source screenshot ${i + 1} for ${fmtDate(draft.reportDate)}`}
                      className="h-16 rounded-md border border-border/60 object-cover"
                    />
                  ))}
                </div>
              )}

              {(draft.warnings.length > 0 || issues.length > 0) && (
                <div className="space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-700">
                  {[...draft.warnings, ...issues].map((w) => (
                    <div key={w} className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              {draft.unmatched.length > 0 && (
                <div className="rounded-lg border border-border/60 p-4">
                  <h3 className="text-sm font-semibold">
                    Unmatched store names ({draft.unmatched.length})
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pick the right store — the alias is saved so future imports match
                    automatically.
                  </p>
                  <div className="mt-3 space-y-2">
                    {draft.unmatched.map((u) => {
                      const suggestions = u.candidates;
                      return (
                        <div
                          key={u.key}
                          className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm"
                        >
                          <span className="font-medium">{u.name}</span>
                          <ConfidenceBadge value={u.confidence} warnings={[]} />
                          <span className="text-xs text-muted-foreground">
                            {METRIC_LABEL[u.metric]} · {u.current ?? "—"} vs {u.previous ?? "—"}
                          </span>
                          <div className="ml-auto flex flex-wrap items-center gap-2">
                            {suggestions.map((s) => (
                              <button
                                key={s.id}
                                onClick={() => mapUnmatched(u.name, s.name)}
                                className="rounded-full border border-border/60 px-2.5 py-1 text-xs transition-colors hover:bg-muted"
                              >
                                {s.name} · {s.score}%
                              </button>
                            ))}
                            <Select onValueChange={(v) => mapUnmatched(u.name, v)}>
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
                </div>
              )}

              {dupIds.size > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-700">
                  <span>
                    {dupIds.size} dealership{dupIds.size > 1 ? "s appear" : " appears"} on more than
                    one row. Auto-merge keeps the highest-confidence value for each metric.
                  </span>
                  <Button size="sm" variant="outline" onClick={() => autoMerge(draft.key)}>
                    <Merge className="mr-2 h-4 w-4" /> Auto-merge duplicates
                  </Button>
                </div>
              )}

              {draft.rows.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-border/60">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr className="border-b border-border/60">
                        <th className="px-4 py-2 text-left font-medium">Store</th>
                        <th className="px-3 py-2 text-left font-medium">Confidence</th>
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
                      {draft.rows.map((r) => (
                        <tr
                          key={r.rowId}
                          className={cn(
                            "border-b border-border/40",
                            r.confidence < 70 && "bg-destructive/5",
                            r.confidence >= 70 && r.confidence < 85 && "bg-amber-500/5",
                          )}
                        >
                          <td className="px-4 py-2 align-top">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{r.name}</span>
                              {dupIds.has(r.dealershipId) && (
                                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                                  duplicate
                                </span>
                              )}
                              {r.matchScore < 100 && (
                                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                                  name match {r.matchScore}%
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              read as “{r.sourceName}”
                              {r.closeRate != null && ` · close ${r.closeRate}%`}
                            </div>
                            {r.matchScore < 92 && (
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] text-muted-foreground">Not right?</span>
                                {r.candidates.map((c) => (
                                  <button
                                    key={c.id}
                                    onClick={() => reassignRow(r, c.name)}
                                    className="rounded-full border border-border/60 px-2 py-0.5 text-[11px] transition-colors hover:bg-muted"
                                  >
                                    {c.name} · {c.score}%
                                  </button>
                                ))}
                                <Select onValueChange={(v) => reassignRow(r, v)}>
                                  <SelectTrigger className="h-7 w-[170px] text-[11px]">
                                    <SelectValue placeholder="Pick another store" />
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
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <ConfidenceBadge value={r.confidence} warnings={r.warnings} />
                            {r.warnings.length > 0 && (
                              <ul className="mt-1 max-w-[220px] space-y-0.5 text-[11px] text-muted-foreground">
                                {r.warnings.slice(0, 2).map((w) => (
                                  <li key={w}>• {w}</li>
                                ))}
                                {r.warnings.length > 2 && (
                                  <li>• +{r.warnings.length - 2} more</li>
                                )}
                              </ul>
                            )}
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
                                onChange={(e) =>
                                  editCell(draft.key, r.rowId, k, e.target.value)
                                }
                                className="h-8 w-24 text-right text-sm"
                                inputMode="decimal"
                              />
                            </td>
                          ))}
                          <td className="px-3 py-2 text-right">
                            <button
                              onClick={() => dropRow(draft.key, r.rowId)}
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
              )}

              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">Notes</div>
                <Textarea
                  value={draft.notes}
                  onChange={(e) => patchDraft(draft.key, { notes: e.target.value })}
                  placeholder="Anything worth remembering about this import…"
                  className="min-h-[70px]"
                />
              </div>
            </section>
          );
        })}

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
