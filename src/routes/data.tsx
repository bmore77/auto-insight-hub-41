import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  computeMetrics,
  hasRealMetrics,
  refreshRoster,
  ROSTER_SIZE,
  type DealershipMetrics,
} from "@/lib/dealerships";
import { SOURCES, type SourceKey } from "@/lib/sources";
import {
  normalizeName,
  resolveName,
  useMapping,
  fuzzySuggest,
  parseMappingFile,
  importMapping,
  type ImportValidation,
} from "@/lib/mapping";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Link2Off,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/data")({
  head: () => ({
    meta: [
      { title: "Data Validation & Mapping — Auto Canada" },
      {
        name: "description",
        content:
          "Validate dealership names across CRM, DMS and media buy datasets, and remap store aliases without editing code.",
      },
      { property: "og:title", content: "Data Validation & Mapping — Auto Canada" },
      {
        property: "og:description",
        content:
          "Spot missing, duplicate, and unmatched dealership names across source datasets and reconcile them.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DataPage,
});

type Issue = {
  kind: "missing" | "duplicate" | "unmatched";
  name: string;
  source: SourceKey | "all";
  detail: string;
};

function DataPage() {
  const [mapping] = useMapping();
  const [version, setVersion] = useState(0);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const canonical = useMemo<DealershipMetrics[]>(
    () => computeMetrics(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );
  const canonicalSet = useMemo(
    () => new Set(canonical.map((d) => normalizeName(d.name))),
    [canonical],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await refreshRoster();
      setLastRefresh(new Date(res.fetchedAt));
      setVersion((v) => v + 1);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!lastRefresh) setLastRefresh(new Date());
  }, [lastRefresh]);

  const report = useMemo(() => {
    const perSource: Record<
      SourceKey,
      { seen: Map<string, number>; unmatched: string[] }
    > = {
      leads: { seen: new Map(), unmatched: [] },
      sales: { seen: new Map(), unmatched: [] },
      adSpend: { seen: new Map(), unmatched: [] },
    };

    for (const src of SOURCES) {
      for (const row of src.rows) {
        const resolved = resolveName(row.name, mapping);
        const key = normalizeName(resolved);
        perSource[src.key].seen.set(
          key,
          (perSource[src.key].seen.get(key) ?? 0) + 1,
        );
        if (!canonicalSet.has(key)) {
          perSource[src.key].unmatched.push(row.name);
        }
      }
    }

    const issues: Issue[] = [];

    // Missing: canonical dealership not present in a given source
    for (const d of canonical) {
      const key = normalizeName(d.name);
      for (const src of SOURCES) {
        if (!perSource[src.key].seen.has(key)) {
          issues.push({
            kind: "missing",
            name: d.name,
            source: src.key,
            detail: `Not present in ${src.label}`,
          });
        }
      }
    }

    // Duplicates: same resolved name appearing >1 in a source
    for (const src of SOURCES) {
      for (const [key, count] of perSource[src.key].seen) {
        if (count > 1) {
          const original = SOURCES.find((s) => s.key === src.key)!
            .rows.find((r) => normalizeName(resolveName(r.name, mapping)) === key);
          issues.push({
            kind: "duplicate",
            name: original?.name ?? key,
            source: src.key,
            detail: `${count} rows in ${src.label}`,
          });
        }
      }
    }

    // Unmatched: source row that doesn't map to a canonical dealership
    for (const src of SOURCES) {
      const uniq = Array.from(new Set(perSource[src.key].unmatched));
      for (const name of uniq) {
        issues.push({
          kind: "unmatched",
          name,
          source: src.key,
          detail: `"${name}" not in dealership list`,
        });
      }
    }

    const counts = {
      missing: issues.filter((i) => i.kind === "missing").length,
      duplicate: issues.filter((i) => i.kind === "duplicate").length,
      unmatched: issues.filter((i) => i.kind === "unmatched").length,
    };

    return { issues, counts };
  }, [canonical, canonicalSet, mapping]);

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
              <div className="text-xs text-muted-foreground">Data Quality</div>
            </div>
          </div>
          <nav className="flex items-center gap-1 text-sm">
            <Link
              to="/"
              className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Dashboard
            </Link>
            <Link
              to="/priority"
              className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Priority
            </Link>
            <Link
              to="/data"
              className="rounded-md bg-muted px-3 py-1.5 text-foreground"
            >
              Data
            </Link>
            <Link
              to="/import"
              className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Import
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-8 py-10">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight">
              Data validation & mapping
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Reconcile dealership names across CRM, DMS, and media buy exports.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-xs text-muted-foreground">
              <div>
                Roster: <span className="font-medium text-foreground">{canonical.length}</span>{" "}
                dealerships
              </div>
              <div>
                {lastRefresh
                  ? `Refreshed ${lastRefresh.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`
                  : "Not refreshed yet"}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={refreshing}
            >
              <RefreshCw
                className={cn("mr-1.5 h-3.5 w-3.5", refreshing && "animate-spin")}
              />
              {refreshing ? "Refreshing…" : "Refresh roster"}
            </Button>
          </div>
        </div>

        <section className="mb-8 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 md:grid-cols-4">
          <SummaryTile
            label="Sources"
            value={SOURCES.length.toString()}
            hint="datasets loaded"
            tone="neutral"
          />
          <SummaryTile
            label="Missing"
            value={report.counts.missing.toString()}
            hint="dealer not in a source"
            tone={report.counts.missing ? "warn" : "ok"}
          />
          <SummaryTile
            label="Duplicates"
            value={report.counts.duplicate.toString()}
            hint="repeat rows in a source"
            tone={report.counts.duplicate ? "warn" : "ok"}
          />
          <SummaryTile
            label="Unmatched"
            value={report.counts.unmatched.toString()}
            hint="no canonical match"
            tone={report.counts.unmatched ? "warn" : "ok"}
          />
        </section>

        <Tabs defaultValue="validation">
          <TabsList className="mb-6">
            <TabsTrigger value="validation">Validation</TabsTrigger>
            <TabsTrigger value="coverage">Coverage</TabsTrigger>
            <TabsTrigger value="mapping">Mapping editor</TabsTrigger>
          </TabsList>

          <TabsContent value="validation">
            <ValidationView issues={report.issues} />
          </TabsContent>

          <TabsContent value="coverage">
            <CoverageView canonical={canonical} mapping={mapping} />
          </TabsContent>

          <TabsContent value="mapping">
            <MappingEditor />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

/* ---------------- Validation ---------------- */

function ValidationView({ issues }: { issues: Issue[] }) {
  const [kind, setKind] = useState<"all" | Issue["kind"]>("all");
  const [source, setSource] = useState<"all" | SourceKey>("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    return issues.filter((i) => {
      if (kind !== "all" && i.kind !== kind) return false;
      if (source !== "all" && i.source !== source) return false;
      if (q && !i.name.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [issues, kind, source, q]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name"
            className="h-9 w-[220px] border-border/60 pl-8 text-sm"
          />
        </div>
        <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
          <SelectTrigger className="h-9 w-[150px] border-border/60 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All issues</SelectItem>
            <SelectItem value="missing">Missing</SelectItem>
            <SelectItem value="duplicate">Duplicate</SelectItem>
            <SelectItem value="unmatched">Unmatched</SelectItem>
          </SelectContent>
        </Select>
        <Select value={source} onValueChange={(v) => setSource(v as typeof source)}>
          <SelectTrigger className="h-9 w-[200px] border-border/60 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {SOURCES.map((s) => (
              <SelectItem key={s.key} value={s.key}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {issues.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card p-6 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          No issues match the current filters.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium">Issue</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Detail</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i, idx) => (
                <IssueRow key={`${i.kind}-${i.name}-${i.source}-${idx}`} issue={i} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function IssueRow({ issue }: { issue: Issue }) {
  const canonical = useMemo(() => computeMetrics().map((d) => d.name), []);
  const [, actions] = useMapping();
  const [pick, setPick] = useState<string>("");
  const showRemap = issue.kind === "unmatched";
  const suggestions = useMemo(
    () => (showRemap ? fuzzySuggest(issue.name, canonical, 3) : []),
    [showRemap, issue.name, canonical],
  );

  return (
    <tr className="border-b border-border/40 last:border-0">
      <td className="px-4 py-3 align-top">
        <IssueBadge kind={issue.kind} />
      </td>
      <td className="px-4 py-3 align-top font-medium">{issue.name}</td>
      <td className="px-4 py-3 align-top text-muted-foreground">
        {SOURCES.find((s) => s.key === issue.source)?.label ?? issue.source}
      </td>
      <td className="px-4 py-3 align-top text-muted-foreground">{issue.detail}</td>
      <td className="px-4 py-3 align-top">
        {showRemap ? (
          <div className="flex flex-col items-end gap-2">
            {suggestions.length > 0 && (
              <div className="flex flex-wrap justify-end gap-1">
                {suggestions.map((s) => (
                  <button
                    key={s.name}
                    onClick={() => actions.set(issue.name, s.name)}
                    title={`${Math.round(s.score * 100)}% match`}
                    className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background px-2 py-0.5 text-[11px] text-foreground/80 transition-colors hover:bg-muted"
                  >
                    <span className="truncate max-w-[180px]">{s.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {Math.round(s.score * 100)}%
                    </span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Select value={pick} onValueChange={setPick}>
                <SelectTrigger className="h-8 w-[220px] border-border/60 text-xs">
                  <SelectValue placeholder="Map to dealership…" />
                </SelectTrigger>
                <SelectContent>
                  {canonical.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                disabled={!pick}
                onClick={() => {
                  actions.set(issue.name, pick);
                  setPick("");
                }}
              >
                Map
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-right text-xs text-muted-foreground">—</div>
        )}
      </td>
    </tr>
  );
}

function IssueBadge({ kind }: { kind: Issue["kind"] }) {
  const cfg =
    kind === "missing"
      ? {
          label: "Missing",
          Icon: AlertTriangle,
          cls: "bg-amber-50 text-amber-700 ring-amber-200",
        }
      : kind === "duplicate"
      ? {
          label: "Duplicate",
          Icon: Copy,
          cls: "bg-sky-50 text-sky-700 ring-sky-200",
        }
      : {
          label: "Unmatched",
          Icon: Link2Off,
          cls: "bg-rose-50 text-rose-700 ring-rose-200",
        };
  const Icon = cfg.Icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        cfg.cls,
      )}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function SummaryTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "ok" | "warn" | "neutral";
}) {
  const color =
    tone === "warn"
      ? "text-amber-700"
      : tone === "ok"
      ? "text-emerald-700"
      : "text-foreground";
  return (
    <div className="bg-card p-5">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={cn("mt-2 text-2xl font-semibold tracking-tight", color)}>
        {value}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

/* ---------------- Mapping editor ---------------- */

function MappingEditor() {
  const [mapping, actions] = useMapping();
  const canonicalNames = useMemo(
    () => computeMetrics().map((d) => d.name),
    [],
  );

  // Collect all raw aliases seen in sources that differ from canonical
  const suggestions = useMemo(() => {
    const canonicalKeys = new Set(canonicalNames.map(normalizeName));
    const raw = new Set<string>();
    for (const src of SOURCES) {
      for (const r of src.rows) {
        if (!canonicalKeys.has(normalizeName(r.name))) raw.add(r.name);
      }
    }
    // Skip aliases already mapped
    return Array.from(raw).filter((n) => !mapping[normalizeName(n)]);
  }, [canonicalNames, mapping]);

  const [alias, setAlias] = useState("");
  const [canonical, setCanonical] = useState<string>("");

  const entries = Object.entries(mapping);

  return (
    <div className="space-y-6">
    <ImportPanel canonicalNames={canonicalNames} />
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <div className="rounded-2xl border border-border/60 bg-card p-6">
        <div className="mb-4">
          <h3 className="text-sm font-semibold tracking-tight">Add mapping</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Point an alias from a source file to the canonical dealership name.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">
              Alias in source data
            </label>
            <Input
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder='e.g. "Maple Ridge VW"'
              className="h-9 border-border/60 text-sm"
              list="alias-suggestions"
            />
            <datalist id="alias-suggestions">
              {suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">
              Canonical dealership
            </label>
            <Select value={canonical} onValueChange={setCanonical}>
              <SelectTrigger className="h-9 border-border/60 text-sm">
                <SelectValue placeholder="Choose dealership…" />
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
          <div className="flex items-center gap-2 pt-2">
            <Button
              disabled={!alias.trim() || !canonical}
              onClick={() => {
                actions.set(alias, canonical);
                setAlias("");
                setCanonical("");
              }}
            >
              Save mapping
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setAlias("");
                setCanonical("");
              }}
            >
              Clear
            </Button>
          </div>
        </div>

        {suggestions.length > 0 && (
          <div className="mt-6 border-t border-border/60 pt-4">
            <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
              Unmapped aliases in sources
            </div>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.slice(0, 20).map((s) => (
                <button
                  key={s}
                  onClick={() => setAlias(s)}
                  className="rounded-full border border-border/60 bg-background px-2.5 py-1 text-[11px] text-foreground/80 transition-colors hover:bg-muted"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border/60 bg-card">
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">
              Active mappings
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {entries.length} alias{entries.length === 1 ? "" : "es"} redirected
            </p>
          </div>
          {entries.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (confirm("Remove all mappings?")) actions.clear();
              }}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Clear all
            </Button>
          )}
        </div>

        {entries.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            No mappings yet. Add one on the left, or click an unmapped alias to
            start.
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {entries.map(([aliasKey, canon]) => (
              <li
                key={aliasKey}
                className="flex items-center justify-between px-6 py-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{aliasKey}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    → {canon}
                  </div>
                </div>
                <button
                  onClick={() => actions.remove(aliasKey)}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label={`Remove mapping for ${aliasKey}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
    </div>
  );
}

/* ---------------- Import panel ---------------- */

function ImportPanel({ canonicalNames }: { canonicalNames: string[] }) {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [result, setResult] = useState<ImportValidation | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const onFile = async (f: File | null) => {
    setDone(null);
    if (!f) return;
    const t = await f.text();
    setFileName(f.name);
    setText(t);
    setResult(parseMappingFile(t, canonicalNames));
  };

  const onValidate = () => {
    setDone(null);
    setResult(parseMappingFile(text, canonicalNames));
  };

  const onApply = () => {
    if (!result?.ok) return;
    const obj: Record<string, string> = {};
    for (const e of result.entries) obj[e.alias] = e.canonical;
    importMapping(obj, mode);
    setDone(
      `Imported ${result.entries.length} mapping${
        result.entries.length === 1 ? "" : "s"
      } (${mode}).`,
    );
    setText("");
    setFileName("");
    setResult(null);
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">
            Import mappings
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Upload a JSON or CSV file, validate, then merge or replace existing
            aliases. Accepted formats: <code>{`{ "alias": "Canonical" }`}</code>,{" "}
            <code>{`[{ "alias", "canonical" }]`}</code>, or CSV with
            <code> alias,canonical</code>.
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border/60 bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted">
          <Upload className="h-3.5 w-3.5" />
          Choose file
          <input
            type="file"
            accept=".json,.csv,.txt,application/json,text/csv"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setResult(null);
          setDone(null);
        }}
        placeholder='{ "Maple Ridge VW": "Maple Ridge Volkswagen" }'
        className="min-h-[120px] w-full rounded-md border border-border/60 bg-background p-3 font-mono text-xs"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {fileName && (
          <span className="text-xs text-muted-foreground">
            Loaded <span className="font-medium text-foreground">{fileName}</span>
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
            <SelectTrigger className="h-9 w-[140px] border-border/60 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="merge">Merge</SelectItem>
              <SelectItem value="replace">Replace all</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={onValidate} disabled={!text.trim()}>
            Validate
          </Button>
          <Button onClick={onApply} disabled={!result?.ok}>
            {mode === "replace" ? "Replace mappings" : "Merge mappings"}
          </Button>
        </div>
      </div>

      {done && (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {done}
        </div>
      )}

      {result && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2 text-xs">
            <Stat
              label="Valid rows"
              value={result.entries.length}
              tone={result.entries.length ? "ok" : "warn"}
            />
            <Stat
              label="Errors"
              value={result.errors.length}
              tone={result.errors.length ? "warn" : "ok"}
            />
            <Stat
              label="Warnings"
              value={result.warnings.length}
              tone={result.warnings.length ? "warn" : "neutral"}
            />
          </div>

          {result.errors.length > 0 && (
            <IssueList
              title="Errors"
              tone="error"
              items={result.errors}
            />
          )}
          {result.warnings.length > 0 && (
            <IssueList
              title="Warnings"
              tone="warn"
              items={result.warnings}
            />
          )}

          {result.entries.length > 0 && (
            <div className="overflow-hidden rounded-md border border-border/60">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/30 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Alias</th>
                    <th className="px-3 py-2 font-medium">→ Canonical</th>
                  </tr>
                </thead>
                <tbody>
                  {result.entries.slice(0, 12).map((e, i) => (
                    <tr key={i} className="border-t border-border/40">
                      <td className="px-3 py-1.5">{e.alias}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">
                        {e.canonical}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.entries.length > 12 && (
                <div className="border-t border-border/40 bg-muted/20 px-3 py-1.5 text-[11px] text-muted-foreground">
                  +{result.entries.length - 12} more…
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "ok" | "warn" | "neutral";
}) {
  const cls =
    tone === "warn"
      ? "bg-amber-50 text-amber-800 ring-amber-200"
      : tone === "ok"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
      : "bg-muted text-foreground ring-border";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 ring-1 ring-inset",
        cls,
      )}
    >
      <span className="font-medium">{value}</span>
      <span className="opacity-80">{label}</span>
    </span>
  );
}

function IssueList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "error" | "warn";
}) {
  const cls =
    tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : "border-amber-200 bg-amber-50 text-amber-800";
  return (
    <div className={cn("rounded-md border px-3 py-2 text-xs", cls)}>
      <div className="mb-1 font-medium">{title}</div>
      <ul className="list-inside list-disc space-y-0.5">
        {items.slice(0, 8).map((m, i) => (
          <li key={i}>{m}</li>
        ))}
        {items.length > 8 && <li>+{items.length - 8} more…</li>}
      </ul>
    </div>
  );
}

/* ---------------- Coverage ---------------- */

function CoverageView({
  canonical,
  mapping,
}: {
  canonical: DealershipMetrics[];
  mapping: Record<string, string>;
}) {
  const rows = useMemo(() => {
    // Where does each canonical dealership appear across sources?
    const presence = new Map<string, Set<SourceKey>>();
    for (const d of canonical) presence.set(normalizeName(d.name), new Set());
    for (const src of SOURCES) {
      for (const r of src.rows) {
        const key = normalizeName(resolveName(r.name, mapping));
        presence.get(key)?.add(src.key);
      }
    }
    return canonical.map((d) => {
      const key = normalizeName(d.name);
      const seenIn = presence.get(key) ?? new Set<SourceKey>();
      const placeholder = !hasRealMetrics(d.id);
      return {
        d,
        seenIn,
        mapped: seenIn.size > 0,
        placeholder,
      };
    });
  }, [canonical, mapping]);

  const mapped = rows.filter((r) => r.mapped).length;
  const unmatched = rows.length - mapped;
  const placeholders = rows.filter((r) => r.placeholder).length;
  const real = rows.length - placeholders;
  const mappedPct = rows.length ? Math.round((mapped / rows.length) * 100) : 0;
  const realPct = rows.length ? Math.round((real / rows.length) * 100) : 0;

  const [filter, setFilter] = useState<
    "all" | "unmatched" | "placeholder" | "verified"
  >("all");
  const [q, setQ] = useState("");

  const filtered = rows.filter((r) => {
    if (filter === "unmatched" && r.mapped) return false;
    if (filter === "placeholder" && !r.placeholder) return false;
    if (filter === "verified" && (r.placeholder || !r.mapped)) return false;
    if (q && !r.d.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <CoverageCard
          title="Roster coverage"
          primary={`${mapped}/${ROSTER_SIZE}`}
          secondary={`${mappedPct}% present in at least one source`}
          pct={mappedPct}
          tone={unmatched === 0 ? "ok" : "warn"}
          footer={
            unmatched > 0
              ? `${unmatched} dealership${unmatched === 1 ? "" : "s"} unmatched`
              : "All dealerships accounted for"
          }
        />
        <CoverageCard
          title="Verified metrics"
          primary={`${real}/${ROSTER_SIZE}`}
          secondary={`${realPct}% backed by Tableau-sourced numbers`}
          pct={realPct}
          tone={placeholders > 0 ? "warn" : "ok"}
          footer={
            placeholders > 0
              ? `${placeholders} store${placeholders === 1 ? "" : "s"} using placeholder metrics`
              : "No placeholder metrics"
          }
        />
        <CoverageCard
          title="Active aliases"
          primary={Object.keys(mapping).length.toString()}
          secondary="Source names remapped to canonical"
          pct={Math.min(100, Object.keys(mapping).length * 8)}
          tone="neutral"
          footer="Managed in the Mapping editor"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search dealership"
            className="h-9 w-[240px] border-border/60 pl-8 text-sm"
          />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="h-9 w-[200px] border-border/60 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All dealerships</SelectItem>
            <SelectItem value="unmatched">Unmatched only</SelectItem>
            <SelectItem value="placeholder">Placeholder metrics</SelectItem>
            <SelectItem value="verified">Verified only</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {rows.length}
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 font-medium">Dealership</th>
              <th className="px-4 py-3 font-medium">Region</th>
              <th className="px-4 py-3 font-medium">Metrics</th>
              <th className="px-4 py-3 font-medium">Present in</th>
              <th className="px-4 py-3 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(({ d, seenIn, mapped, placeholder }) => (
              <tr
                key={d.id}
                className="border-b border-border/40 last:border-0"
              >
                <td className="px-4 py-3 font-medium">{d.name}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {d.region} · {d.brand}
                </td>
                <td className="px-4 py-3">
                  {placeholder ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                      Placeholder
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                      Verified
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {SOURCES.map((s) => {
                      const on = seenIn.has(s.key);
                      return (
                        <span
                          key={s.key}
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] ring-1 ring-inset",
                            on
                              ? "bg-foreground/5 text-foreground ring-border"
                              : "bg-muted/40 text-muted-foreground/60 ring-transparent line-through",
                          )}
                        >
                          {s.label.split(" ")[0]}
                        </span>
                      );
                    })}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  {mapped ? (
                    <span className="text-xs text-emerald-700">Mapped</span>
                  ) : (
                    <span className="text-xs text-rose-700">Unmatched</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CoverageCard({
  title,
  primary,
  secondary,
  footer,
  pct,
  tone,
}: {
  title: string;
  primary: string;
  secondary: string;
  footer: string;
  pct: number;
  tone: "ok" | "warn" | "neutral";
}) {
  const bar =
    tone === "warn"
      ? "bg-amber-500"
      : tone === "ok"
      ? "bg-emerald-500"
      : "bg-foreground/70";
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{primary}</div>
      <div className="mt-1 text-xs text-muted-foreground">{secondary}</div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", bar)}
          style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
        />
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground">{footer}</div>
    </div>
  );
}

