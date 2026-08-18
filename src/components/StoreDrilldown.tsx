import { BrandMark } from "@/components/BrandMark";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatCurrency,
  formatDelta,
  formatDeltaPt,
  formatPct,
  PRIORITY_WEIGHTS,
  type DealershipMetrics,
} from "@/lib/dealerships";
import {
  STATUS_LABEL,
  suggestedSteps,
  type ActionPlan,
  type PlanStatus,
  emptyPlan,
} from "@/lib/action-plans";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { ChevronDown, Plus, RotateCcw, Trash2 } from "lucide-react";

type Props = {
  dealership: DealershipMetrics | null;
  rank: number | null;
  plan: ActionPlan | undefined;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onStatus: (status: PlanStatus) => void;
  onOwner: (owner: string) => void;
  onAddStep: (text: string) => void;
  onToggleStep: (stepId: string) => void;
  onRemoveStep: (stepId: string) => void;
  onAddNote: (text: string) => void;
  onRemoveNote: (noteId: string) => void;
  onReset: () => void;
};

/* ---------- series ---------- */

function series(prev: number, curr: number, seed: number) {
  const out: number[] = [];
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    const wobble = Math.sin(i * 1.1 + seed) * (Math.max(prev, curr) * 0.05);
    out.push(Math.max(0, prev + (curr - prev) * t + wobble));
  }
  out[11] = curr;
  return out;
}

function useChartData(d: DealershipMetrics) {
  return useMemo(() => {
    const leads = series(d.leadsPrev, d.leads, 0.3);
    const sales = series(d.salesPrev, d.sales, 1.7);
    const spend = series(d.adSpendPrev, d.adSpend, 2.4);
    return leads.map((l, i) => ({
      week: `W${i + 1}`,
      leads: Math.round(l),
      sales: Math.round(sales[i]),
      close: l > 0 ? (sales[i] / l) * 100 : 0,
      spend: Math.round(spend[i]),
      cpl: l > 0 ? spend[i] / l : 0,
    }));
  }, [d]);
}

/* ---------- component ---------- */

export function StoreDrilldown(props: Props) {
  const { dealership: d, rank, open, onOpenChange } = props;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto p-0 sm:max-w-[720px]"
      >
        {d && (
          <>
            <SheetHeader className="border-b border-border/60 px-6 py-5">
              <div className="flex items-center gap-3">
                <BrandMark brand={d.brand} storeId={d.id} size="lg" />
                <div>
                  <SheetTitle className="text-left text-lg font-semibold tracking-tight">
                    {d.name}
                  </SheetTitle>
                  <p className="text-left text-xs text-muted-foreground">
                    {rank ? `Rank ${rank} · ` : ""}
                    {d.city} · {d.region} · {d.brand}
                  </p>
                </div>
              </div>
            </SheetHeader>

            <div className="space-y-8 px-6 py-6">
              <ScoreExplainer d={d} />
              <Comparison d={d} />
              <Charts d={d} />
              <PlanEditor {...props} d={d} />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ---------- 1. interactive score explanation ---------- */

function ScoreExplainer({ d }: { d: DealershipMetrics }) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  const factors = useMemo(() => {
    const rows = [
      {
        key: "leads",
        label: "Lead volume",
        weight: PRIORITY_WEIGHTS.leads,
        score: d.leadsScore,
        delta: formatDelta(d.leadsDelta),
        worsening: d.leadsDelta < 0,
        detail:
          d.leadsDelta < 0
            ? `Leads fell from ${d.leadsPrev.toLocaleString()} to ${d.leads.toLocaleString()} (${formatDelta(d.leadsDelta)}). Lead decline carries the heaviest weight, so this is pushing the score up the most.`
            : `Leads grew from ${d.leadsPrev.toLocaleString()} to ${d.leads.toLocaleString()} (${formatDelta(d.leadsDelta)}). Growth adds nothing to the priority score — it pulls this store down the list.`,
      },
      {
        key: "sales",
        label: "Sales volume",
        weight: PRIORITY_WEIGHTS.sales,
        score: d.salesScore,
        delta: formatDelta(d.salesDelta),
        worsening: d.salesDelta < 0,
        detail:
          d.salesDelta < 0
            ? `Sales dropped from ${d.salesPrev} to ${d.sales} units (${formatDelta(d.salesDelta)}), confirming the lead decline is reaching the bottom line.`
            : `Sales moved from ${d.salesPrev} to ${d.sales} units (${formatDelta(d.salesDelta)}) — no upward pressure on the score.`,
      },
      {
        key: "close",
        label: "Closing %",
        weight: PRIORITY_WEIGHTS.close,
        score: d.closeScore,
        delta: formatDeltaPt(d.closeRateDelta),
        worsening: d.closeRateDelta < 0,
        detail:
          d.closeRateDelta < 0
            ? `Close rate slipped from ${formatPct(d.closeRatePrev)} to ${formatPct(d.closeRate)} (${formatDeltaPt(d.closeRateDelta)}) — a process problem, not just a volume problem.`
            : `Close rate improved from ${formatPct(d.closeRatePrev)} to ${formatPct(d.closeRate)} (${formatDeltaPt(d.closeRateDelta)}), so the floor is converting what it gets.`,
      },
      {
        key: "cpl",
        label: "Ad spend impact",
        weight: PRIORITY_WEIGHTS.cpl,
        score: d.cplScore,
        delta: formatDelta(d.cplDelta),
        worsening: d.cplDelta > 0,
        detail:
          d.cplDelta > 0
            ? `CPL rose from ${formatCurrency(d.cplPrev)} to ${formatCurrency(d.cpl)} (${formatDelta(d.cplDelta)}) on ${formatCurrency(d.adSpend)} of spend — you're paying more for fewer leads.`
            : `CPL fell from ${formatCurrency(d.cplPrev)} to ${formatCurrency(d.cpl)} (${formatDelta(d.cplDelta)}) — media efficiency is not a concern here.`,
      },
    ];
    return rows
      .map((r) => ({ ...r, contribution: r.weight * r.score }))
      .sort((a, b) => b.contribution - a.contribution);
  }, [d]);

  const total = d.priorityScore;

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-medium tracking-tight">Why this score</h3>
        <div className="text-xs text-muted-foreground">
          <span className="text-2xl font-semibold tabular-nums text-foreground">
            {total.toFixed(0)}
          </span>{" "}
          / 100
        </div>
      </div>

      <div className="mb-3 flex h-2.5 overflow-hidden rounded-full bg-muted">
        {factors.map((f) => (
          <div
            key={f.key}
            className={cn("h-full", barColor(f.key))}
            style={{ width: `${f.contribution}%` }}
            title={`${f.label}: +${f.contribution.toFixed(1)} pts`}
          />
        ))}
      </div>

      <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-card">
        {factors.map((f, i) => {
          const isOpen = openKey === f.key;
          return (
            <div key={f.key}>
              <button
                onClick={() => setOpenKey(isOpen ? null : f.key)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
              >
                <span className={cn("h-2 w-2 shrink-0 rounded-full", barColor(f.key))} />
                <span className="w-[120px] shrink-0 text-sm">{f.label}</span>
                <span className="text-[11px] text-muted-foreground">
                  {Math.round(f.weight * 100)}% weight
                </span>
                <span
                  className={cn(
                    "ml-auto text-xs tabular-nums",
                    f.worsening ? "text-rose-600" : "text-emerald-600",
                  )}
                >
                  {f.delta}
                </span>
                <span className="w-[92px] text-right text-xs tabular-nums text-muted-foreground">
                  {f.contribution > 0.05 ? "+" : ""}
                  {f.contribution.toFixed(1)} pts
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    isOpen && "rotate-180",
                  )}
                />
              </button>
              {isOpen && (
                <div className="bg-muted/30 px-4 pb-4 pt-1 text-xs leading-relaxed text-muted-foreground">
                  <p>{f.detail}</p>
                  <p className="mt-2">
                    {f.contribution > 0.05 ? (
                      <span className="font-medium text-rose-600">
                        Driving the score up
                        {i === 0 ? " — this is the top contributing factor." : "."}
                      </span>
                    ) : (
                      <span className="font-medium text-emerald-600">
                        Pulling the score down — no priority pressure from this metric.
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Each factor is normalized 0–100 against the worst store in the network, then weighted.
        Click a row for the detail.
      </p>
    </section>
  );
}

function barColor(key: string) {
  return key === "leads"
    ? "bg-rose-500"
    : key === "sales"
    ? "bg-orange-500"
    : key === "close"
    ? "bg-amber-500"
    : "bg-sky-500";
}

/* ---------- 2. period comparison ---------- */

function Comparison({ d }: { d: DealershipMetrics }) {
  const rows = [
    {
      label: "Leads",
      curr: d.leads.toLocaleString(),
      prev: d.leadsPrev.toLocaleString(),
      delta: formatDelta(d.leadsDelta),
      bad: d.leadsDelta < 0,
    },
    {
      label: "Sales",
      curr: d.sales.toLocaleString(),
      prev: d.salesPrev.toLocaleString(),
      delta: formatDelta(d.salesDelta),
      bad: d.salesDelta < 0,
    },
    {
      label: "Close %",
      curr: formatPct(d.closeRate),
      prev: formatPct(d.closeRatePrev),
      delta: formatDeltaPt(d.closeRateDelta),
      bad: d.closeRateDelta < 0,
    },
    {
      label: "Ad spend",
      curr: formatCurrency(d.adSpend),
      prev: formatCurrency(d.adSpendPrev),
      delta: formatDelta(d.adSpendDelta),
      bad: d.adSpendDelta > 0,
    },
    {
      label: "CPL",
      curr: formatCurrency(d.cpl),
      prev: formatCurrency(d.cplPrev),
      delta: formatDelta(d.cplDelta),
      bad: d.cplDelta > 0,
    },
    {
      label: "CPS",
      curr: formatCurrency(d.cps),
      prev: formatCurrency(d.cpsPrev),
      delta: formatDelta(d.cps > 0 && d.cpsPrev > 0 ? d.cps / d.cpsPrev - 1 : 0),
      bad: d.cps > d.cpsPrev,
    },
  ];
  return (
    <section>
      <h3 className="mb-3 text-sm font-medium tracking-tight">
        Period vs previous period
      </h3>
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <div className="grid grid-cols-4 border-b border-border/60 px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>Metric</span>
          <span className="text-right">Current</span>
          <span className="text-right">Previous</span>
          <span className="text-right">Change</span>
        </div>
        {rows.map((r) => (
          <div
            key={r.label}
            className="grid grid-cols-4 border-b border-border/40 px-4 py-2.5 text-sm last:border-0"
          >
            <span className="text-muted-foreground">{r.label}</span>
            <span className="text-right font-medium tabular-nums">{r.curr}</span>
            <span className="text-right tabular-nums text-muted-foreground">{r.prev}</span>
            <span
              className={cn(
                "text-right tabular-nums",
                r.bad ? "text-rose-600" : "text-emerald-600",
              )}
            >
              {r.delta}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- 3. trend charts ---------- */

function Charts({ d }: { d: DealershipMetrics }) {
  const data = useChartData(d);
  const axis = {
    stroke: "hsl(var(--muted-foreground))",
    fontSize: 10,
    tickLine: false,
    axisLine: false,
  } as const;
  const tooltipStyle = {
    contentStyle: {
      borderRadius: 12,
      border: "1px solid hsl(var(--border))",
      background: "hsl(var(--card))",
      fontSize: 12,
    },
  };

  return (
    <section>
      <h3 className="mb-3 text-sm font-medium tracking-tight">Trends</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ChartCard title="Leads" value={d.leads.toLocaleString()} delta={formatDelta(d.leadsDelta)} bad={d.leadsDelta < 0}>
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="2 4" />
            <XAxis dataKey="week" {...axis} />
            <YAxis {...axis} width={46} />
            <Tooltip {...tooltipStyle} />
            <Area type="monotone" dataKey="leads" stroke="#e11d48" fill="#e11d48" fillOpacity={0.08} strokeWidth={2} />
          </AreaChart>
        </ChartCard>

        <ChartCard title="Sales" value={d.sales.toLocaleString()} delta={formatDelta(d.salesDelta)} bad={d.salesDelta < 0}>
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="2 4" />
            <XAxis dataKey="week" {...axis} />
            <YAxis {...axis} width={46} />
            <Tooltip {...tooltipStyle} />
            <Area type="monotone" dataKey="sales" stroke="#ea580c" fill="#ea580c" fillOpacity={0.08} strokeWidth={2} />
          </AreaChart>
        </ChartCard>

        <ChartCard title="Closing %" value={formatPct(d.closeRate)} delta={formatDeltaPt(d.closeRateDelta)} bad={d.closeRateDelta < 0}>
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="2 4" />
            <XAxis dataKey="week" {...axis} />
            <YAxis {...axis} width={46} tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => `${v.toFixed(1)}%`} />
            <Line type="monotone" dataKey="close" stroke="#d97706" strokeWidth={2} dot={false} />
          </LineChart>
        </ChartCard>

        <ChartCard title="Ad spend & CPL" value={formatCurrency(d.adSpend)} delta={formatDelta(d.cplDelta)} bad={d.cplDelta > 0}>
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="2 4" />
            <XAxis dataKey="week" {...axis} />
            <YAxis {...axis} width={46} />
            <YAxis yAxisId="r" orientation="right" {...axis} width={34} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => v.toFixed(0)} />
            <Line type="monotone" dataKey="spend" stroke="#0284c7" strokeWidth={2} dot={false} />
            <Line yAxisId="r" type="monotone" dataKey="cpl" stroke="#64748b" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
          </LineChart>
        </ChartCard>
      </div>
    </section>
  );
}

function ChartCard({
  title,
  value,
  delta,
  bad,
  children,
}: {
  title: string;
  value: string;
  delta: string;
  bad: boolean;
  children: React.ReactElement;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <span className={cn("text-[11px] tabular-nums", bad ? "text-rose-600" : "text-emerald-600")}>
          {delta}
        </span>
      </div>
      <div className="mb-2 text-lg font-semibold tabular-nums tracking-tight">{value}</div>
      <div className="h-[132px]">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ---------- 4. action plan ---------- */

function PlanEditor({
  d,
  plan,
  onStatus,
  onOwner,
  onAddStep,
  onToggleStep,
  onRemoveStep,
  onAddNote,
  onRemoveNote,
  onReset,
}: Props & { d: DealershipMetrics }) {
  const p = plan ?? emptyPlan(d.id, d.priorityScore);
  const [stepText, setStepText] = useState("");
  const [noteText, setNoteText] = useState("");
  const done = p.steps.filter((s) => s.done).length;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium tracking-tight">Action plan</h3>
        <button
          onClick={onReset}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <RotateCcw className="h-3 w-3" /> Reset
        </button>
      </div>

      <div className="space-y-4 rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          {(["not_started", "in_progress", "addressed"] as PlanStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => onStatus(s)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                p.status === s
                  ? s === "addressed"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : s === "in_progress"
                    ? "border-amber-300 bg-amber-50 text-amber-700"
                    : "border-border bg-muted text-foreground"
                  : "border-border/60 text-muted-foreground hover:bg-muted/50",
              )}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
          <Input
            value={p.owner}
            onChange={(e) => onOwner(e.target.value)}
            placeholder="Owner"
            className="ml-auto h-8 w-[160px] border-border/60 text-xs"
          />
        </div>

        <div className="text-[11px] text-muted-foreground">
          {p.scoreWhenRanked != null && (
            <>Ranked at score {p.scoreWhenRanked.toFixed(0)} · </>
          )}
          {done}/{p.steps.length} steps complete
          {p.status === "addressed" && (
            <> · addressed {new Date(p.updatedAt).toLocaleDateString()}</>
          )}
        </div>

        {/* steps */}
        <div className="space-y-1.5">
          {p.steps.map((s) => (
            <div
              key={s.id}
              className="group flex items-start gap-2 rounded-lg px-1 py-1 hover:bg-muted/40"
            >
              <Checkbox
                checked={s.done}
                onCheckedChange={() => onToggleStep(s.id)}
                className="mt-0.5"
              />
              <span
                className={cn(
                  "flex-1 text-sm",
                  s.done && "text-muted-foreground line-through",
                )}
              >
                {s.text}
              </span>
              <button
                onClick={() => onRemoveStep(s.id)}
                className="opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Remove step"
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-rose-600" />
              </button>
            </div>
          ))}
          {p.steps.length === 0 && (
            <p className="text-xs text-muted-foreground">No next steps yet.</p>
          )}
        </div>

        <div className="flex gap-2">
          <Input
            value={stepText}
            onChange={(e) => setStepText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && stepText.trim()) {
                onAddStep(stepText.trim());
                setStepText("");
              }
            }}
            placeholder="Add a next step…"
            className="h-9 border-border/60 text-sm"
          />
          <Button
            size="sm"
            variant="secondary"
            className="h-9"
            onClick={() => {
              if (!stepText.trim()) return;
              onAddStep(stepText.trim());
              setStepText("");
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div>
          <div className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            Suggested from this store's flags
          </div>
          <div className="flex flex-wrap gap-1.5">
            {suggestedSteps(d.reasons)
              .filter((s) => !p.steps.some((x) => x.text === s))
              .map((s) => (
                <button
                  key={s}
                  onClick={() => onAddStep(s)}
                  className="rounded-full border border-dashed border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
                >
                  + {s}
                </button>
              ))}
          </div>
        </div>
      </div>

      {/* notes */}
      <div className="mt-4 rounded-2xl border border-border/60 bg-card p-4">
        <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          Notes
        </div>
        <Textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="What did you find? What did you change?"
          className="min-h-[70px] border-border/60 text-sm"
        />
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            onClick={() => {
              if (!noteText.trim()) return;
              onAddNote(noteText.trim());
              setNoteText("");
            }}
          >
            Add note
          </Button>
        </div>
        <div className="mt-3 space-y-2">
          {p.notes.map((n) => (
            <div key={n.id} className="group rounded-lg bg-muted/40 p-3">
              <div className="flex items-start gap-2">
                <p className="flex-1 whitespace-pre-wrap text-sm">{n.text}</p>
                <button
                  onClick={() => onRemoveNote(n.id)}
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Remove note"
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-rose-600" />
                </button>
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                {new Date(n.at).toLocaleString()}
              </div>
            </div>
          ))}
          {p.notes.length === 0 && (
            <p className="text-xs text-muted-foreground">No notes yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}
