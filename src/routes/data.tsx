import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { computeMetrics } from "@/lib/dealerships";
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
  Search,
  Trash2,
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

  const canonical = useMemo(() => computeMetrics(), []);
  const canonicalSet = useMemo(
    () => new Set(canonical.map((d) => normalizeName(d.name))),
    [canonical],
  );

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
              to="/data"
              className="rounded-md bg-muted px-3 py-1.5 text-foreground"
            >
              Data
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-8 py-10">
        <div className="mb-8">
          <h1 className="text-[28px] font-semibold tracking-tight">
            Data validation & mapping
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reconcile dealership names across CRM, DMS, and media buy exports.
          </p>
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
            <TabsTrigger value="mapping">Mapping editor</TabsTrigger>
          </TabsList>

          <TabsContent value="validation">
            <ValidationView issues={report.issues} />
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
    <div className="grid gap-6 lg:grid-cols-[1fr,1fr]">
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
  );
}
