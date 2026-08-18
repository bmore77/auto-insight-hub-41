import { createFileRoute, Link } from "@tanstack/react-router";
import acLogo from "@/assets/auto-canada.webp.asset.json";
import { useMemo, useState } from "react";
import {
  formatCurrency,
  formatDelta,
  formatDeltaPt,
  formatPct,
  PRIORITY_WEIGHTS,
  type DealershipMetrics,
} from "@/lib/dealerships";
import { useDashboardData } from "@/lib/snapshots";
import { SnapshotPicker } from "@/components/SnapshotPicker";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowDown, ArrowUp, Flame, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { StoreDrilldown } from "@/components/StoreDrilldown";
import { BrandMark } from "@/components/BrandMark";
import { channelBreakdown, CHANNEL_META } from "@/lib/channels";

import { STATUS_LABEL, useActionPlans, type ActionPlan } from "@/lib/action-plans";

export const Route = createFileRoute("/priority")({
  head: () => ({
    meta: [
      { title: "Store Priority Ranking — Auto Canada" },
      {
        name: "description",
        content:
          "Ranked list of Auto Canada dealerships scored by lead decline, sales, close rate, and ad spend efficiency to surface stores needing help first.",
      },
      { property: "og:title", content: "Store Priority Ranking — Auto Canada" },
      {
        property: "og:description",
        content:
          "See which Auto Canada stores need help first — weighted priority score with lead, sales, close, and CPL breakdown.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PriorityPage,
});

type Bucket = "all" | "high" | "med" | "low";

function PriorityPage() {
  const dash = useDashboardData();
  const metrics = dash.metrics;
  const [region, setRegion] = useState("All");
  const [brand, setBrand] = useState("All");
  const [bucket, setBucket] = useState<Bucket>("all");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [onlyOpen, setOnlyOpen] = useState(false);
  const plansApi = useActionPlans();
  const { plans } = plansApi;

  const regions = useMemo(
    () => ["All", ...Array.from(new Set(metrics.map((m) => m.region)))],
    [metrics],
  );
  const brands = useMemo(
    () => ["All", ...Array.from(new Set(metrics.map((m) => m.brand)))].sort(),
    [metrics],
  );

  const ranked = useMemo(() => {
    return metrics
      .filter((m) => {
        if (region !== "All" && m.region !== region) return false;
        if (brand !== "All" && m.brand !== brand) return false;
        if (q && !m.name.toLowerCase().includes(q.toLowerCase())) return false;
        const b = tier(m.priorityScore);
        if (bucket !== "all" && b !== bucket) return false;
        if (onlyOpen && plans[m.id]?.status === "addressed") return false;
        return true;
      })
      .sort((a, b) => b.priorityScore - a.priorityScore);
  }, [metrics, region, brand, q, bucket, onlyOpen, plans]);

  const tierCounts = useMemo(() => {
    const c = { high: 0, med: 0, low: 0 };
    for (const m of metrics) c[tier(m.priorityScore)]++;
    return c;
  }, [metrics]);

  const selected = metrics.find((m) => m.id === selectedId);
  const rankIndex = ranked.findIndex((m) => m.id === selectedId);
  const selectedRank = rankIndex >= 0 ? rankIndex + 1 : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-8 py-5">
          <div className="flex items-center gap-3">
            <img src={acLogo.url} alt="AutoCanada" className="h-7 w-auto" />
            <div className="hidden h-6 w-px bg-border sm:block" />
            <div className="hidden text-xs text-muted-foreground sm:block">Priority Ranking</div>
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
              className="rounded-md bg-muted px-3 py-1.5 text-foreground"
            >
              Priority
            </Link>
            <Link
              to="/data"
              className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
          <SnapshotPicker
            snapshots={dash.snapshots}
            selected={dash.selected}
            onSelect={dash.selectId}
            source={dash.source}
            className="ml-3"
          />
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-8 py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight">
              Store priority ranking
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Every store scored 0–100 on lead change, sales, close rate, and CPL impact.
              Highest scores need help first.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1.5 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Weights</span>
            <WeightPill label="Leads" pct={PRIORITY_WEIGHTS.leads} />
            <WeightPill label="Sales" pct={PRIORITY_WEIGHTS.sales} />
            <WeightPill label="Close" pct={PRIORITY_WEIGHTS.close} />
            <WeightPill label="CPL" pct={PRIORITY_WEIGHTS.cpl} />
          </div>
        </div>

        <section className="mb-8 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60">
          <TierTile
            label="High priority"
            count={tierCounts.high}
            tone="high"
            active={bucket === "high"}
            onClick={() => setBucket(bucket === "high" ? "all" : "high")}
          />
          <TierTile
            label="Medium priority"
            count={tierCounts.med}
            tone="med"
            active={bucket === "med"}
            onClick={() => setBucket(bucket === "med" ? "all" : "med")}
          />
          <TierTile
            label="Stable"
            count={tierCounts.low}
            tone="low"
            active={bucket === "low"}
            onClick={() => setBucket(bucket === "low" ? "all" : "low")}
          />
        </section>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search store"
              className="h-9 w-[240px] border-border/60 pl-8 text-sm"
            />
          </div>
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger className="h-9 w-[150px] border-border/60 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {regions.map((r) => (
                <SelectItem key={r} value={r}>
                  {r === "All" ? "All regions" : r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={brand} onValueChange={setBrand}>
            <SelectTrigger className="h-9 w-[160px] border-border/60 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {brands.map((b) => (
                <SelectItem key={b} value={b}>
                  {b === "All" ? "All brands" : b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            onClick={() => setOnlyOpen((v) => !v)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs transition-colors",
              onlyOpen
                ? "border-foreground/20 bg-muted text-foreground"
                : "border-border/60 text-muted-foreground hover:bg-muted/50",
            )}
          >
            Hide addressed
          </button>
          <span className="ml-auto text-xs text-muted-foreground">
            {ranked.length} of {metrics.length}
          </span>
        </div>

        <div className="space-y-2">
          {ranked.map((d, i) => (
            <PriorityRow
              key={d.id}
              rank={i + 1}
              d={d}
              plan={plans[d.id]}
              onOpen={() => setSelectedId(d.id)}
            />
          ))}
          {ranked.length === 0 && (
            <div className="rounded-2xl border border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">
              No stores match the current filters.
            </div>
          )}
        </div>
      </main>

      <StoreDrilldown
        open={selected != null}
        onOpenChange={(v) => !v && setSelectedId(null)}
        dealership={selected ?? null}
        rank={selectedRank}
        plan={selected ? plans[selected.id] : undefined}
        onStatus={(s) => selected && plansApi.setStatus(selected.id, selected.priorityScore, s)}
        onOwner={(o) => selected && plansApi.setOwner(selected.id, selected.priorityScore, o)}
        onAddStep={(t) => selected && plansApi.addStep(selected.id, selected.priorityScore, t)}
        onToggleStep={(id) =>
          selected && plansApi.toggleStep(selected.id, selected.priorityScore, id)
        }
        onRemoveStep={(id) =>
          selected && plansApi.removeStep(selected.id, selected.priorityScore, id)
        }
        onAddNote={(t) => selected && plansApi.addNote(selected.id, selected.priorityScore, t)}
        onRemoveNote={(id) =>
          selected && plansApi.removeNote(selected.id, selected.priorityScore, id)
        }
        onReset={() => selected && plansApi.resetPlan(selected.id)}
      />
    </div>
  );
}

/* -------------- Row -------------- */

function PriorityRow({
  rank,
  d,
  plan,
  onOpen,
}: {
  rank: number;
  d: DealershipMetrics;
  plan?: ActionPlan;
  onOpen: () => void;
}) {
  const contrib = {
    leads: PRIORITY_WEIGHTS.leads * d.leadsScore,
    sales: PRIORITY_WEIGHTS.sales * d.salesScore,
    close: PRIORITY_WEIGHTS.close * d.closeScore,
    cpl: PRIORITY_WEIGHTS.cpl * d.cplScore,
  };
  const t = tier(d.priorityScore);
  const border =
    t === "high"
      ? "border-rose-200"
      : t === "med"
      ? "border-amber-200"
      : "border-border/60";

  return (
    <button
      onClick={onOpen}
      className={cn(
        "group lift spotlight animate-fade-up grid w-full grid-cols-[56px_1fr_340px_200px] items-center gap-6 rounded-2xl border bg-card px-5 py-4 text-left shadow-soft",
        border,
        plan?.status === "addressed" && "opacity-70",
      )}
    >
      <div className="flex flex-col items-center">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Rank
        </span>
        <span className="text-2xl font-semibold tabular-nums">
          {rank.toString().padStart(2, "0")}
        </span>
      </div>

      <div className="flex min-w-0 items-start gap-3">
        <BrandMark brand={d.brand} storeId={d.id} size="lg" className="mt-0.5" />
        <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{d.name}</span>
          {t === "high" && <Flame className="h-3.5 w-3.5 text-rose-600" />}
          {plan && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium",
                plan.status === "addressed"
                  ? "bg-emerald-50 text-emerald-700"
                  : plan.status === "in_progress"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {STATUS_LABEL[plan.status]}
            </span>
          )}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {d.city} · {d.region} · {d.brand}
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {d.reasons.slice(0, 4).map((r) => (
            <span
              key={r}
              className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground/80"
            >
              {r}
            </span>
          ))}
          {d.reasons.length === 0 && (
            <span className="text-[11px] text-muted-foreground">Trending stable</span>
          )}
        </div>
        </div>
      </div>


      <div className="space-y-1.5">
        <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          Score breakdown
        </div>
        <ContribBar
          label="Leads"
          contribution={contrib.leads}
          weight={PRIORITY_WEIGHTS.leads}
          delta={formatDelta(d.leadsDelta)}
          color="bg-rose-500"
        />
        <ContribBar
          label="Sales"
          contribution={contrib.sales}
          weight={PRIORITY_WEIGHTS.sales}
          delta={formatDelta(d.salesDelta)}
          color="bg-orange-500"
        />
        <ContribBar
          label="Close"
          contribution={contrib.close}
          weight={PRIORITY_WEIGHTS.close}
          delta={formatDeltaPt(d.closeRateDelta)}
          color="bg-amber-500"
        />
        <ContribBar
          label="CPL"
          contribution={contrib.cpl}
          weight={PRIORITY_WEIGHTS.cpl}
          delta={formatDelta(d.cplDelta)}
          color="bg-sky-500"
        />
      </div>

      <div className="flex flex-col items-end gap-2">
        <ScoreRing score={d.priorityScore} tier={t} />
        <div className="grid grid-cols-3 gap-2 text-right text-[11px] text-muted-foreground">
          <MiniMetric label="Leads" value={d.leads.toLocaleString()} />
          <MiniMetric label="Sales" value={d.sales.toLocaleString()} />
          <MiniMetric label="Close" value={formatPct(d.closeRate, 0)} />
          <MiniMetric label="Spend" value={formatCurrency(d.adSpend)} />
          <MiniMetric label="CPL" value={formatCurrency(d.cpl)} />
          <MiniMetric label="CPS" value={formatCurrency(d.cps)} />
        </div>
        <ChannelStrip d={d} />
      </div>
    </button>
  );
}

function ContribBar({
  label,
  contribution,
  weight,
  delta,
  color,
}: {
  label: string;
  contribution: number;
  weight: number;
  delta: string;
  color: string;
}) {
  const maxContribution = 100 * weight;
  const pct = Math.max(2, Math.min(100, (contribution / maxContribution) * 100));
  const isBad = delta.startsWith("-") ? label !== "CPL" : label === "CPL" && !delta.startsWith("-");
  const isGoodMove = delta === "+0.0%" || delta === "+0.0pt";
  return (
    <div className="grid grid-cols-[44px_1fr_60px] items-center gap-2">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span
        className={cn(
          "text-right text-[11px] tabular-nums",
          isGoodMove ? "text-muted-foreground" : isBad ? "text-rose-600" : "text-emerald-600",
        )}
      >
        {delta}
      </span>
    </div>
  );
}

function ScoreRing({ score, tier }: { score: number; tier: "high" | "med" | "low" }) {
  const pct = Math.max(0, Math.min(100, score));
  const stroke =
    tier === "high" ? "#e11d48" : tier === "med" ? "#d97706" : "#059669";
  const r = 24;
  const c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;
  return (
    <div className="relative h-14 w-14">
      <svg viewBox="0 0 60 60" className="h-full w-full -rotate-90">
        <circle cx="30" cy="30" r={r} stroke="hsl(var(--muted))" strokeWidth="6" fill="none" />
        <circle
          cx="30"
          cy="30"
          r={r}
          stroke={stroke}
          strokeWidth="6"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={off}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-semibold tabular-nums leading-none">
          {score.toFixed(0)}
        </span>
        <span className="mt-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
          score
        </span>
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70">
        {label}
      </div>
      <div className="tabular-nums text-foreground">{value}</div>
    </div>
  );
}

/* -------------- Bits -------------- */

function TierTile({
  label,
  count,
  tone,
  active,
  onClick,
}: {
  label: string;
  count: number;
  tone: "high" | "med" | "low";
  active: boolean;
  onClick: () => void;
}) {
  const dot =
    tone === "high" ? "bg-rose-500" : tone === "med" ? "bg-amber-500" : "bg-emerald-500";
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-start bg-card p-5 text-left transition-colors hover:bg-muted/40",
        active && "bg-muted/60",
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", dot)} />
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
        {count}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {tone === "high"
          ? "Score ≥ 70 — act now"
          : tone === "med"
          ? "Score 40–69 — monitor closely"
          : "Score < 40 — stable"}
      </div>
    </button>
  );
}

function WeightPill({ label, pct }: { label: string; pct: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground/80">
      {label} <span className="tabular-nums">{Math.round(pct * 100)}%</span>
    </span>
  );
}

function tier(score: number): "high" | "med" | "low" {
  if (score >= 70) return "high";
  if (score >= 40) return "med";
  return "low";
}

// unused imports guard (keep arrow icons available for future direction indicators)
void ArrowUp;
void ArrowDown;

/* ---------- channel spend strip on each leaderboard row ---------- */

function ChannelStrip({ d }: { d: DealershipMetrics }) {
  const rows = channelBreakdown(d);
  const worst = rows.reduce((a, b) => (b.riskScore > a.riskScore ? b : a), rows[0]);
  return (
    <div className="w-full">
      <div className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full">
        {rows.map((c) => (
          <span
            key={c.key}
            className="h-full rounded-full"
            style={{ width: `${Math.max(3, c.share * 100)}%`, background: c.color }}
            title={`${c.label}: ${formatCurrency(c.spend)}`}
          />
        ))}
      </div>
      <div className="mt-1 flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
        {rows.map((c) => (
          <span key={c.key} className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.color }} />
            {CHANNEL_META[c.key].short}
          </span>
        ))}
        {worst && worst.riskScore >= 40 && (
          <span className="rounded-full bg-danger-soft px-1.5 py-0.5 font-medium text-danger">
            {CHANNEL_META[worst.key].short} at risk
          </span>
        )}
      </div>
    </div>
  );
}
