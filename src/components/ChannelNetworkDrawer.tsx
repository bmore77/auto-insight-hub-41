import { useMemo } from "react";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { BrandMark } from "@/components/BrandMark";
import {
  CHANNEL_META,
  networkChannelSeries,
  storesByChannel,
  type ChannelKey,
  type NetworkChannelRow,
} from "@/lib/channels";
import { formatCurrency, formatPct, type DealershipMetrics } from "@/lib/dealerships";
import { cn } from "@/lib/utils";

function Delta({ value, invert = false }: { value: number; invert?: boolean }) {
  const good = invert ? value <= 0 : value >= 0;
  return (
    <span
      className={cn(
        "num text-[11px] font-medium",
        good ? "text-success" : "text-danger",
      )}
    >
      {value >= 0 ? "+" : ""}
      {(value * 100).toFixed(1)}%
    </span>
  );
}

function Stat({
  label,
  value,
  delta,
  invert,
}: {
  label: string;
  value: string;
  delta?: number;
  invert?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-surface-muted/50 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="num mt-0.5 text-lg font-semibold tracking-tight">{value}</div>
      {delta !== undefined && <Delta value={delta} invert={invert} />}
    </div>
  );
}

export function ChannelNetworkDrawer({
  channel,
  list,
  onClose,
  onSelectStore,
}: {
  channel: NetworkChannelRow | null;
  list: DealershipMetrics[];
  onClose: () => void;
  onSelectStore: (d: DealershipMetrics) => void;
}) {
  const key = channel?.key as ChannelKey | undefined;
  const meta = key ? CHANNEL_META[key] : null;

  const series = useMemo(
    () => (channel ? networkChannelSeries(channel) : []),
    [channel],
  );
  const stores = useMemo(
    () => (key ? storesByChannel(list, key).slice(0, 15) : []),
    [key, list],
  );

  return (
    <Sheet open={!!channel} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[640px]">
        {channel && meta && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3">
                <span
                  className="grid h-10 w-10 place-items-center rounded-xl text-sm font-semibold text-white"
                  style={{ background: meta.color }}
                >
                  {channel.key === "google" ? "G" : channel.key === "meta" ? "M" : "B"}
                </span>
                <div>
                  <SheetTitle className="text-xl">{meta.label}</SheetTitle>
                  <SheetDescription>
                    {(channel.share * 100).toFixed(0)}% of network spend · {list.length} stores
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Stat label="Spend" value={formatCurrency(channel.spend)} delta={channel.spendDelta} invert />
              <Stat label="Leads" value={channel.leads.toLocaleString()} delta={channel.leadsDelta} />
              <Stat label="Sales" value={channel.sales.toLocaleString()} delta={channel.salesDelta} />
              <Stat label="Close %" value={formatPct(channel.closeRate)} />
              <Stat label="CPL" value={formatCurrency(channel.cpl)} />
              <Stat label="Cost / sale" value={formatCurrency(channel.cps)} />
            </div>

            <div className="mt-8">
              <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                Leads vs sales — last 12 weeks
              </div>
              <div className="h-52 rounded-xl border border-border/60 p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series}>
                    <defs>
                      <linearGradient id={`ch-${channel.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={meta.color} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={meta.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
                    <XAxis dataKey="week" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={34} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Area
                      type="monotone"
                      dataKey="leads"
                      stroke={meta.color}
                      strokeWidth={2}
                      fill={`url(#ch-${channel.key})`}
                    />
                    <Line type="monotone" dataKey="sales" stroke="oklch(0.55 0.22 27)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                Spend &amp; CPL — last 12 weeks
              </div>
              <div className="h-44 rounded-xl border border-border/60 p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
                    <XAxis dataKey="week" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="l" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={40} />
                    <YAxis
                      yAxisId="r"
                      orientation="right"
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      width={34}
                    />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Line yAxisId="l" type="monotone" dataKey="spend" stroke={meta.color} strokeWidth={2} dot={false} />
                    <Line
                      yAxisId="r"
                      type="monotone"
                      dataKey="cpl"
                      stroke="oklch(0.38 0.13 258)"
                      strokeDasharray="3 3"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="mt-8">
              <div className="mb-2 flex items-baseline justify-between">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Stores dragging {meta.short} down
                </div>
                <span className="text-[11px] text-muted-foreground">open a store for full detail</span>
              </div>
              <div className="space-y-2">
                {stores.map(({ store, channel: c }) => (
                  <button
                    key={store.id}
                    type="button"
                    onClick={() => {
                      onClose();
                      onSelectStore(store);
                    }}
                    className="lift flex w-full items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-2.5 text-left"
                  >
                    <BrandMark brand={store.brand} storeId={store.id} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{store.name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {store.city} · {formatCurrency(c.spend)} spend · {c.leads.toLocaleString()} leads
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="num text-sm font-semibold">{formatCurrency(c.cpl)}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">CPL</div>
                    </div>
                    <div className="w-14 text-right">
                      <Delta value={c.leadsDelta} />
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">leads</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
