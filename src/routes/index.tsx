import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  computeMetrics,
  networkTotals,
  formatCurrency,
  formatDelta,
  formatDeltaPt,
  formatPct,
  type DealershipMetrics,
} from "@/lib/dealerships";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dealership Priority — Auto Canada" },
      {
        name: "description",
        content:
          "Rank Auto Canada dealerships by leads, sales, close rate, and ad spend to spot stores that need help fastest.",
      },
      { property: "og:title", content: "Dealership Priority — Auto Canada" },
      {
        property: "og:description",
        content:
          "Executive dashboard highlighting which Auto Canada stores need attention this period.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

type Period = "This Month" | "Last Month" | "QTD" | "YTD";
type Compare = "Previous Period" | "Same Period Last Year";

function Dashboard() {
  const [period, setPeriod] = useState<Period>("This Month");
  const [compare, setCompare] = useState<Compare>("Previous Period");
  const [region, setRegion] = useState<string>("All");
  const [brand, setBrand] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof DealershipMetrics>("priorityScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<DealershipMetrics | null>(null);

  const metrics = useMemo(() => computeMetrics(), []);

  const regions = useMemo(
    () => ["All", ...Array.from(new Set(metrics.map((m) => m.region)))],
    [metrics],
  );
  const brands = useMemo(
    () => ["All", ...Array.from(new Set(metrics.map((m) => m.brand)))],
    [metrics],
  );

  const filtered = useMemo(() => {
    return metrics.filter((m) => {
      if (region !== "All" && m.region !== region) return false;
      if (brand !== "All" && m.brand !== brand) return false;
      if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [metrics, region, brand, search]);

  const totals = useMemo(() => networkTotals(filtered), [filtered]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = a[sortKey] as number;
      const bv = b[sortKey] as number;
      if (typeof av === "string" || typeof bv === "string") {
        return sortDir === "asc"
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const topPriority = useMemo(
    () => [...filtered].sort((a, b) => b.priorityScore - a.priorityScore).slice(0, 5),
    [filtered],
  );

  const toggleSort = (key: keyof DealershipMetrics) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-8 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background text-sm font-semibold">
              A
            </div>
            <div>
              <div className="text-sm font-medium tracking-tight">Auto Canada</div>
              <div className="text-xs text-muted-foreground">Dealership Priority</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <nav className="mr-2 flex items-center gap-1 text-sm">
              <Link
                to="/"
                className="rounded-md bg-muted px-3 py-1.5 text-foreground"
              >
                Dashboard
              </Link>
              <Link
                to="/data"
                className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Data
              </Link>
            </nav>
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger className="h-9 w-[150px] border-border/60 bg-background text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["This Month", "Last Month", "QTD", "YTD"] as Period[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={compare} onValueChange={(v) => setCompare(v as Compare)}>
              <SelectTrigger className="h-9 w-[210px] border-border/60 bg-background text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Previous Period">vs Previous Period</SelectItem>
                <SelectItem value="Same Period Last Year">
                  vs Same Period Last Year
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-8 py-10">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-[28px] font-semibold tracking-tight">
            Where to focus — {period}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered.length} dealerships · comparing {compare.toLowerCase()}
          </p>
        </div>

        {/* KPI Strip */}
        <section className="mb-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 md:grid-cols-3 lg:grid-cols-6">
          <Kpi label="Leads" value={totals.leads.toLocaleString()} delta={totals.leadsDelta} />
          <Kpi label="Sales" value={totals.sales.toLocaleString()} delta={totals.salesDelta} />
          <Kpi
            label="Close Rate"
            value={formatPct(totals.closeRate)}
            deltaPt={totals.closeRate - totals.closeRatePrev}
          />
          <Kpi
            label="Ad Spend"
            value={formatCurrency(totals.adSpend)}
            delta={totals.adSpendDelta}
            invert
          />
          <Kpi
            label="Blended CPL"
            value={formatCurrency(totals.cpl)}
            delta={(totals.cpl - totals.cplPrev) / (totals.cplPrev || 1)}
            invert
          />
          <Kpi
            label="Cost / Sale"
            value={formatCurrency(totals.cps)}
            delta={(totals.cps - totals.cpsPrev) / (totals.cpsPrev || 1)}
            invert
          />
        </section>

        {/* Priority hero */}
        <section className="mb-12">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Stores needing help</h2>
            <span className="text-xs text-muted-foreground">
              Ranked by lead decline, weighted by sales, close rate, and CPL
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {topPriority.map((d, i) => (
              <PriorityCard
                key={d.id}
                rank={i + 1}
                dealership={d}
                onClick={() => setSelected(d)}
              />
            ))}
          </div>
        </section>

        {/* Full table */}
        <section>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h2 className="mr-auto text-lg font-semibold tracking-tight">All dealerships</h2>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search"
                className="h-9 w-[220px] border-border/60 pl-8 text-sm"
              />
            </div>
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger className="h-9 w-[140px] border-border/60 text-sm">
                <SelectValue placeholder="Region" />
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
              <SelectTrigger className="h-9 w-[140px] border-border/60 text-sm">
                <SelectValue placeholder="Brand" />
              </SelectTrigger>
              <SelectContent>
                {brands.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b === "All" ? "All brands" : b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <Th onClick={() => toggleSort("name")} active={sortKey === "name"} dir={sortDir} className="text-left">
                    Dealership
                  </Th>
                  <Th onClick={() => toggleSort("leads")} active={sortKey === "leads"} dir={sortDir}>
                    Leads
                  </Th>
                  <Th onClick={() => toggleSort("sales")} active={sortKey === "sales"} dir={sortDir}>
                    Sales
                  </Th>
                  <Th onClick={() => toggleSort("closeRate")} active={sortKey === "closeRate"} dir={sortDir}>
                    Close %
                  </Th>
                  <Th onClick={() => toggleSort("adSpend")} active={sortKey === "adSpend"} dir={sortDir}>
                    Ad Spend
                  </Th>
                  <Th onClick={() => toggleSort("cpl")} active={sortKey === "cpl"} dir={sortDir}>
                    CPL
                  </Th>
                  <Th onClick={() => toggleSort("cps")} active={sortKey === "cps"} dir={sortDir}>
                    Cost / Sale
                  </Th>
                  <Th
                    onClick={() => toggleSort("priorityScore")}
                    active={sortKey === "priorityScore"}
                    dir={sortDir}
                  >
                    Priority
                  </Th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((d) => (
                  <tr
                    key={d.id}
                    onClick={() => setSelected(d)}
                    className="cursor-pointer border-b border-border/40 transition-colors last:border-0 hover:bg-muted/40"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{d.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {d.city} · {d.brand}
                      </div>
                    </td>
                    <NumCell value={d.leads.toLocaleString()} delta={d.leadsDelta} />
                    <NumCell value={d.sales.toLocaleString()} delta={d.salesDelta} />
                    <NumCell value={formatPct(d.closeRate)} deltaPt={d.closeRateDelta} />
                    <NumCell
                      value={formatCurrency(d.adSpend)}
                      delta={d.adSpendDelta}
                      invert
                    />
                    <NumCell value={formatCurrency(d.cpl)} delta={d.cplDelta} invert />
                    <NumCell value={formatCurrency(d.cps)} />
                    <td className="px-4 py-3 text-right">
                      <PriorityPill score={d.priorityScore} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <StoreDrawer store={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

/* -------------- pieces -------------- */

function Kpi({
  label,
  value,
  delta,
  deltaPt,
  invert,
}: {
  label: string;
  value: string;
  delta?: number;
  deltaPt?: number;
  invert?: boolean;
}) {
  return (
    <div className="bg-card p-5">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      {delta !== undefined && (
        <div className="mt-1">
          <DeltaChip value={delta} invert={invert} />
        </div>
      )}
      {deltaPt !== undefined && (
        <div className="mt-1">
          <DeltaChip valuePt={deltaPt} />
        </div>
      )}
    </div>
  );
}

function DeltaChip({
  value,
  valuePt,
  invert,
}: {
  value?: number;
  valuePt?: number;
  invert?: boolean;
}) {
  const raw = value ?? valuePt ?? 0;
  const good = invert ? raw < 0 : raw > 0;
  const bad = invert ? raw > 0 : raw < 0;
  const color = good
    ? "text-emerald-600"
    : bad
    ? "text-rose-600"
    : "text-muted-foreground";
  const Icon = raw > 0 ? ArrowUp : raw < 0 ? ArrowDown : null;
  const label = value !== undefined ? formatDelta(value) : formatDeltaPt(valuePt!);
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", color)}>
      {Icon && <Icon className="h-3 w-3" />}
      {label}
    </span>
  );
}

function PriorityCard({
  rank,
  dealership,
  onClick,
}: {
  rank: number;
  dealership: DealershipMetrics;
  onClick: () => void;
}) {
  const data = dealership.trend.map((v, i) => ({ i, v }));
  return (
    <button
      onClick={onClick}
      className="group flex flex-col rounded-2xl border border-border/60 bg-card p-5 text-left transition-all hover:border-border hover:shadow-sm"
    >
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          #{rank}
        </span>
        <PriorityPill score={dealership.priorityScore} />
      </div>
      <div className="mt-3">
        <div className="font-medium leading-tight">{dealership.name}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {dealership.city} · {dealership.brand}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {dealership.reasons.slice(0, 3).map((r) => (
          <span
            key={r}
            className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground/80"
          >
            {r}
          </span>
        ))}
        {dealership.reasons.length === 0 && (
          <span className="text-[11px] text-muted-foreground">Trending stable</span>
        )}
      </div>
      <div className="-mx-1 mt-4 h-10">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <Line
              type="monotone"
              dataKey="v"
              stroke="currentColor"
              strokeWidth={1.5}
              dot={false}
              className="text-foreground/60"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </button>
  );
}

function PriorityPill({ score }: { score: number }) {
  const level =
    score >= 70 ? "high" : score >= 40 ? "med" : "low";
  const styles =
    level === "high"
      ? "bg-rose-50 text-rose-700 ring-rose-200"
      : level === "med"
      ? "bg-amber-50 text-amber-700 ring-amber-200"
      : "bg-emerald-50 text-emerald-700 ring-emerald-200";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        styles,
      )}
    >
      {score.toFixed(0)}
    </span>
  );
}

function Th({
  children,
  onClick,
  active,
  dir,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  dir: "asc" | "desc";
  className?: string;
}) {
  return (
    <th
      onClick={onClick}
      className={cn(
        "cursor-pointer select-none px-4 py-3 text-right font-medium",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {active ? (
          dir === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </span>
    </th>
  );
}

function NumCell({
  value,
  delta,
  deltaPt,
  invert,
}: {
  value: string;
  delta?: number;
  deltaPt?: number;
  invert?: boolean;
}) {
  return (
    <td className="px-4 py-3 text-right">
      <div className="tabular-nums">{value}</div>
      {(delta !== undefined || deltaPt !== undefined) && (
        <div className="mt-0.5">
          <DeltaChip value={delta} valuePt={deltaPt} invert={invert} />
        </div>
      )}
    </td>
  );
}

/* -------------- Drawer -------------- */

function StoreDrawer({
  store,
  onClose,
}: {
  store: DealershipMetrics | null;
  onClose: () => void;
}) {
  const open = !!store;
  const chartData = store
    ? store.trend.map((v, i) => ({
        week: `W${i + 1}`,
        leads: v,
        sales: Math.round(v * store.closeRate),
      }))
    : [];

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[560px]">
        {store && (
          <>
            <SheetHeader>
              <div className="flex items-center justify-between">
                <PriorityPill score={store.priorityScore} />
                <span className="text-xs text-muted-foreground">
                  {store.region} · {store.brand}
                </span>
              </div>
              <SheetTitle className="text-xl">{store.name}</SheetTitle>
              <SheetDescription>{store.city}</SheetDescription>
            </SheetHeader>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <MiniStat label="Leads" value={store.leads.toLocaleString()} delta={store.leadsDelta} />
              <MiniStat label="Sales" value={store.sales.toLocaleString()} delta={store.salesDelta} />
              <MiniStat
                label="Close Rate"
                value={formatPct(store.closeRate)}
                deltaPt={store.closeRateDelta}
              />
              <MiniStat
                label="Ad Spend"
                value={formatCurrency(store.adSpend)}
                delta={store.adSpendDelta}
                invert
              />
              <MiniStat
                label="CPL"
                value={formatCurrency(store.cpl)}
                delta={store.cplDelta}
                invert
              />
              <MiniStat label="Cost / Sale" value={formatCurrency(store.cps)} />
            </div>

            <div className="mt-8">
              <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                Leads vs Sales — last 12 weeks
              </div>
              <div className="h-56 rounded-xl border border-border/60 p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
                    <XAxis dataKey="week" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={28} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid hsl(var(--border))",
                        fontSize: 12,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="leads"
                      stroke="hsl(var(--foreground))"
                      strokeWidth={1.75}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="sales"
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="mt-8">
              <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                Why it's flagged
              </div>
              {store.reasons.length ? (
                <ul className="space-y-1.5 text-sm">
                  {store.reasons.map((r) => (
                    <li key={r} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1 w-1 rounded-full bg-foreground/60" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  This store is trending stable or improving.
                </p>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function MiniStat({
  label,
  value,
  delta,
  deltaPt,
  invert,
}: {
  label: string;
  value: string;
  delta?: number;
  deltaPt?: number;
  invert?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/60 p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
      {(delta !== undefined || deltaPt !== undefined) && (
        <div className="mt-0.5">
          <DeltaChip value={delta} valuePt={deltaPt} invert={invert} />
        </div>
      )}
    </div>
  );
}
