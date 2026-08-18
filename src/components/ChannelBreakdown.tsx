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
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import {
  channelBreakdown,
  channelSeries,
  type ChannelMetrics,
} from "@/lib/channels";
import {
  formatCurrency,
  formatDelta,
  formatDeltaPt,
  formatPct,
  type DealershipMetrics,
} from "@/lib/dealerships";

export function ChannelBreakdown({ d }: { d: DealershipMetrics }) {
  const rows = useMemo(() => channelBreakdown(d), [d]);
  const [open, setOpen] = useState<string | null>(rows[0]?.key ?? null);

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-medium tracking-tight">Ad spend by channel</h3>
        <span className="num text-xs text-muted-foreground">
          {formatCurrency(d.adSpend)} total · {formatDelta(d.adSpendDelta)}
        </span>
      </div>

      {/* share bar */}
      <div className="mb-3 flex h-2.5 gap-1 overflow-hidden rounded-full">
        {rows.map((c) => (
          <div
            key={c.key}
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${Math.max(2, c.share * 100)}%`, background: c.color }}
            title={`${c.label}: ${(c.share * 100).toFixed(0)}%`}
          />
        ))}
      </div>

      <div className="space-y-3">
        {rows.map((c) => (
          <ChannelCard
            key={c.key}
            c={c}
            storeId={d.id}
            open={open === c.key}
            onToggle={() => setOpen(open === c.key ? null : c.key)}
          />
        ))}
      </div>
    </section>
  );
}

function ChannelCard({
  c,
  storeId,
  open,
  onToggle,
}: {
  c: ChannelMetrics;
  storeId: string;
  open: boolean;
  onToggle: () => void;
}) {
  const data = useMemo(() => channelSeries(c, storeId), [c, storeId]);
  const risk =
    c.riskScore >= 55 ? "critical" : c.riskScore >= 25 ? "watch" : "healthy";

  return (
    <div
      className={cn(
        "group overflow-hidden rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm transition-all duration-300",
        open ? "shadow-raised" : "shadow-soft hover:-translate-y-0.5 hover:shadow-raised",
      )}
      style={{ ["--ch" as string]: c.color }}
    >
      <button
        onClick={onToggle}
        className="relative flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        <span
          className="absolute inset-y-0 left-0 w-[3px]"
          style={{ background: c.color, opacity: open ? 1 : 0.45 }}
        />
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-[11px] font-semibold text-white shadow-soft"
          style={{ background: c.color }}
        >
          {c.key === "google" ? "G" : c.key === "meta" ? "M" : "B"}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium">{c.label}</span>
          <span className="num block text-[11px] text-muted-foreground">
            {(c.share * 100).toFixed(0)}% of spend · {c.leads.toLocaleString()} leads ·{" "}
            {formatCurrency(c.cpl)} CPL
          </span>
        </span>
        <span className="ml-auto flex items-center gap-3">
          <span className="num text-right text-sm font-semibold">{formatCurrency(c.spend)}</span>
          <span
            className={cn(
              "num rounded-full px-2 py-0.5 text-[11px] font-medium ring-1",
              risk === "critical"
                ? "bg-danger-soft text-danger ring-danger-border"
                : risk === "watch"
                  ? "bg-warning-soft text-warning ring-warning-border"
                  : "bg-success-soft text-success ring-success-border",
            )}
          >
            {risk === "critical" ? "Needs help" : risk === "watch" ? "Watch" : "Healthy"}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-300",
              open && "rotate-180",
            )}
          />
        </span>
      </button>

      <div
        className={cn(
          "grid transition-all duration-300 ease-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-4 border-t border-border/50 px-4 pb-5 pt-4">
            <p className="text-xs leading-relaxed text-muted-foreground">{c.headline}</p>

            {c.reasons.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {c.reasons.map((r) => (
                  <span
                    key={r}
                    className="rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-medium text-danger ring-1 ring-danger-border"
                  >
                    {r}
                  </span>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Stat label="Spend" value={formatCurrency(c.spend)} prev={formatCurrency(c.spendPrev)} delta={formatDelta(c.spendDelta)} bad={c.spendDelta > 0} />
              <Stat label="Leads" value={c.leads.toLocaleString()} prev={c.leadsPrev.toLocaleString()} delta={formatDelta(c.leadsDelta)} bad={c.leadsDelta < 0} />
              <Stat label="Sales" value={c.sales.toLocaleString()} prev={c.salesPrev.toLocaleString()} delta={formatDelta(c.salesDelta)} bad={c.salesDelta < 0} />
              <Stat label="Close %" value={formatPct(c.closeRate)} prev={formatPct(c.closeRatePrev)} delta={formatDeltaPt(c.closeRateDelta)} bad={c.closeRateDelta < 0} />
              <Stat label="CPL" value={formatCurrency(c.cpl)} prev={formatCurrency(c.cplPrev)} delta={formatDelta(c.cplDelta)} bad={c.cplDelta > 0} />
              <Stat label="Cost / sale" value={formatCurrency(c.cps)} prev={formatCurrency(c.cpsPrev)} delta={formatDelta(c.cpsDelta)} bad={c.cpsDelta > 0} />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MiniChart title="Leads" value={c.leads.toLocaleString()} delta={formatDelta(c.leadsDelta)} bad={c.leadsDelta < 0}>
                <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                  <defs>
                    <linearGradient id={`g-${storeId}-${c.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={c.color} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={c.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="2 4" />
                  <XAxis dataKey="week" stroke="var(--muted-foreground)" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={9} tickLine={false} axisLine={false} width={38} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="leads" stroke={c.color} strokeWidth={2} fill={`url(#g-${storeId}-${c.key})`} />
                </AreaChart>
              </MiniChart>

              <MiniChart title="Spend & CPL" value={formatCurrency(c.spend)} delta={formatDelta(c.cplDelta)} bad={c.cplDelta > 0}>
                <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="2 4" />
                  <XAxis dataKey="week" stroke="var(--muted-foreground)" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={9} tickLine={false} axisLine={false} width={38} />
                  <YAxis yAxisId="r" orientation="right" stroke="var(--muted-foreground)" fontSize={9} tickLine={false} axisLine={false} width={28} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => v.toFixed(0)} />
                  <Line type="monotone" dataKey="spend" stroke={c.color} strokeWidth={2} dot={false} />
                  <Line yAxisId="r" type="monotone" dataKey="cpl" stroke="var(--muted-foreground)" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
                </LineChart>
              </MiniChart>

              <MiniChart title="Sales" value={c.sales.toLocaleString()} delta={formatDelta(c.salesDelta)} bad={c.salesDelta < 0}>
                <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="2 4" />
                  <XAxis dataKey="week" stroke="var(--muted-foreground)" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={9} tickLine={false} axisLine={false} width={38} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="sales" stroke={c.color} strokeWidth={2} fillOpacity={0.08} fill={c.color} />
                </AreaChart>
              </MiniChart>

              <MiniChart title="Close %" value={formatPct(c.closeRate)} delta={formatDeltaPt(c.closeRateDelta)} bad={c.closeRateDelta < 0}>
                <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="2 4" />
                  <XAxis dataKey="week" stroke="var(--muted-foreground)" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={9} tickLine={false} axisLine={false} width={38} tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v.toFixed(1)}%`} />
                  <Line type="monotone" dataKey="close" stroke={c.color} strokeWidth={2} dot={false} />
                </LineChart>
              </MiniChart>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--card)",
  fontSize: 12,
} as const;

function Stat({
  label,
  value,
  prev,
  delta,
  bad,
}: {
  label: string;
  value: string;
  prev: string;
  delta: string;
  bad: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-surface-muted/60 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="num text-sm font-semibold">{value}</div>
      <div className="num text-[11px] text-muted-foreground">
        prev {prev} ·{" "}
        <span className={bad ? "text-danger" : "text-success"}>{delta}</span>
      </div>
    </div>
  );
}

function MiniChart({
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
    <div className="rounded-xl border border-border/50 bg-card p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{title}</span>
        <span className={cn("num text-[11px]", bad ? "text-danger" : "text-success")}>{delta}</span>
      </div>
      <div className="num mb-1 text-base font-semibold tracking-tight">{value}</div>
      <div className="h-[110px]">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
