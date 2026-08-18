import type { DealershipMetrics } from "@/lib/dealerships";

export type ChannelKey = "google" | "meta" | "bing";

export const CHANNEL_META: Record<
  ChannelKey,
  { label: string; short: string; color: string; accent: string }
> = {
  google: { label: "Google Ads", short: "Google", color: "#1a73e8", accent: "oklch(0.58 0.18 258)" },
  meta: { label: "Meta Ads", short: "Meta", color: "#0866ff", accent: "oklch(0.62 0.2 265)" },
  bing: { label: "Bing Ads", short: "Bing", color: "#00897b", accent: "oklch(0.58 0.11 190)" },
};

export const CHANNEL_ORDER: ChannelKey[] = ["google", "meta", "bing"];

export type ChannelMetrics = {
  key: ChannelKey;
  label: string;
  color: string;
  spend: number;
  spendPrev: number;
  spendDelta: number;
  share: number;
  sharePrev: number;
  leads: number;
  leadsPrev: number;
  leadsDelta: number;
  sales: number;
  salesPrev: number;
  salesDelta: number;
  closeRate: number;
  closeRatePrev: number;
  closeRateDelta: number;
  cpl: number;
  cplPrev: number;
  cplDelta: number;
  cps: number;
  cpsPrev: number;
  cpsDelta: number;
  /** 0-100: how much this channel is dragging the store down. */
  riskScore: number;
  reasons: string[];
  headline: string;
};

/* deterministic pseudo random from a seed string */
const rand = (seed: string, salt: number) => {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
};

const pctDelta = (curr: number, prev: number) => (prev === 0 ? 0 : (curr - prev) / prev);

/** Spend mix per store — stable across renders, sums to 1. */
function mix(id: string, salt: number): Record<ChannelKey, number> {
  const google = 0.46 + rand(id, salt) * 0.22; // 46-68%
  const meta = (1 - google) * (0.55 + rand(id, salt + 7) * 0.3); // most of the rest
  const bing = 1 - google - meta;
  return { google, meta, bing };
}

/** Relative lead efficiency (leads per dollar) and close strength per channel. */
const LEAD_WEIGHT: Record<ChannelKey, number> = { google: 1, meta: 1.35, bing: 0.82 };
const CLOSE_WEIGHT: Record<ChannelKey, number> = { google: 1.15, meta: 0.72, bing: 1.0 };

function allocate(
  total: number,
  spendMix: Record<ChannelKey, number>,
  weights: Record<ChannelKey, number>,
  jitter: (k: ChannelKey) => number,
) {
  const raw = CHANNEL_ORDER.map((k) => spendMix[k] * weights[k] * jitter(k));
  const sum = raw.reduce((a, b) => a + b, 0) || 1;
  const out = {} as Record<ChannelKey, number>;
  let assigned = 0;
  CHANNEL_ORDER.forEach((k, i) => {
    const v = i === CHANNEL_ORDER.length - 1 ? total - assigned : Math.round((raw[i] / sum) * total);
    out[k] = Math.max(0, v);
    assigned += out[k];
  });
  return out;
}

export function channelBreakdown(d: DealershipMetrics): ChannelMetrics[] {
  const curMix = mix(d.id, 11);
  // previous-period mix drifts slightly (budget shifting between platforms)
  const drift = (rand(d.id, 23) - 0.5) * 0.12;
  const prevMix: Record<ChannelKey, number> = {
    google: Math.min(0.85, Math.max(0.2, curMix.google - drift)),
    meta: Math.min(0.7, Math.max(0.1, curMix.meta + drift * 0.7)),
    bing: 0,
  };
  prevMix.bing = Math.max(0.02, 1 - prevMix.google - prevMix.meta);
  const prevNorm = prevMix.google + prevMix.meta + prevMix.bing;
  CHANNEL_ORDER.forEach((k) => (prevMix[k] = prevMix[k] / prevNorm));

  const jitterCur = (k: ChannelKey) => 0.85 + rand(d.id + k, 31) * 0.3;
  const jitterPrev = (k: ChannelKey) => 0.85 + rand(d.id + k, 47) * 0.3;

  const spend = allocate(Math.round(d.adSpend), curMix, { google: 1, meta: 1, bing: 1 }, () => 1);
  const spendPrev = allocate(
    Math.round(d.adSpendPrev),
    prevMix,
    { google: 1, meta: 1, bing: 1 },
    () => 1,
  );

  const leads = allocate(Math.round(d.leads), curMix, LEAD_WEIGHT, jitterCur);
  const leadsPrev = allocate(Math.round(d.leadsPrev), prevMix, LEAD_WEIGHT, jitterPrev);

  const salesMixCur = {} as Record<ChannelKey, number>;
  const salesMixPrev = {} as Record<ChannelKey, number>;
  const leadTotal = CHANNEL_ORDER.reduce((a, k) => a + leads[k], 0) || 1;
  const leadTotalPrev = CHANNEL_ORDER.reduce((a, k) => a + leadsPrev[k], 0) || 1;
  CHANNEL_ORDER.forEach((k) => {
    salesMixCur[k] = leads[k] / leadTotal;
    salesMixPrev[k] = leadsPrev[k] / leadTotalPrev;
  });
  const sales = allocate(Math.round(d.sales), salesMixCur, CLOSE_WEIGHT, jitterCur);
  const salesPrev = allocate(Math.round(d.salesPrev), salesMixPrev, CLOSE_WEIGHT, jitterPrev);

  const rows = CHANNEL_ORDER.map((k) => {
    const s = spend[k];
    const sp = spendPrev[k];
    const l = leads[k];
    const lp = leadsPrev[k];
    const u = sales[k];
    const up = salesPrev[k];
    const closeRate = l > 0 ? u / l : 0;
    const closeRatePrev = lp > 0 ? up / lp : 0;
    const cpl = l > 0 ? s / l : 0;
    const cplPrev = lp > 0 ? sp / lp : 0;
    const cps = u > 0 ? s / u : 0;
    const cpsPrev = up > 0 ? sp / up : 0;

    const leadsDelta = pctDelta(l, lp);
    const salesDelta = pctDelta(u, up);
    const cplDelta = pctDelta(cpl, cplPrev);
    const closeRateDelta = closeRate - closeRatePrev;

    const reasons: string[] = [];
    if (leadsDelta <= -0.05) reasons.push(`Leads down ${Math.abs(leadsDelta * 100).toFixed(0)}%`);
    if (cplDelta >= 0.1) reasons.push(`CPL up ${(cplDelta * 100).toFixed(0)}%`);
    if (closeRateDelta <= -0.01)
      reasons.push(`Close rate down ${Math.abs(closeRateDelta * 100).toFixed(1)}pt`);
    if (pctDelta(s, sp) >= 0.15 && leadsDelta <= 0)
      reasons.push(`Spend up ${(pctDelta(s, sp) * 100).toFixed(0)}% with no lead lift`);

    const riskScore = Math.max(
      0,
      Math.min(
        100,
        Math.max(0, -leadsDelta) * 130 +
          Math.max(0, cplDelta) * 90 +
          Math.max(0, -salesDelta) * 60 +
          Math.max(0, -closeRateDelta) * 400,
      ),
    );

    const headline =
      reasons.length === 0
        ? `Healthy — ${l.toLocaleString()} leads at ${money(cpl)} CPL, holding a ${(closeRate * 100).toFixed(1)}% close rate.`
        : cplDelta >= 0.1 && leadsDelta < 0
          ? `Paying more for less: spend of ${money(s)} produced ${l.toLocaleString()} leads (${fmtDelta(leadsDelta)}) at ${money(cpl)} CPL (${fmtDelta(cplDelta)}).`
          : leadsDelta < 0
            ? `Volume problem: leads fell to ${l.toLocaleString()} (${fmtDelta(leadsDelta)}) on ${money(s)} of spend.`
            : `Efficiency problem: ${money(s)} of spend at ${money(cps)} per sale (${fmtDelta(pctDelta(cps, cpsPrev))}).`;

    return {
      key: k,
      label: CHANNEL_META[k].label,
      color: CHANNEL_META[k].color,
      spend: s,
      spendPrev: sp,
      spendDelta: pctDelta(s, sp),
      share: d.adSpend > 0 ? s / d.adSpend : 0,
      sharePrev: d.adSpendPrev > 0 ? sp / d.adSpendPrev : 0,
      leads: l,
      leadsPrev: lp,
      leadsDelta,
      sales: u,
      salesPrev: up,
      salesDelta,
      closeRate,
      closeRatePrev,
      closeRateDelta,
      cpl,
      cplPrev,
      cplDelta,
      cps,
      cpsPrev,
      cpsDelta: pctDelta(cps, cpsPrev),
      riskScore,
      reasons,
      headline,
    } satisfies ChannelMetrics;
  });

  return rows;
}

const money = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`);
const fmtDelta = (n: number) => `${n >= 0 ? "+" : ""}${(n * 100).toFixed(0)}%`;

/** 12-point weekly series for a channel metric. */
export function channelSeries(c: ChannelMetrics, storeId: string) {
  const step = (prev: number, curr: number, seed: number) => {
    const out: number[] = [];
    for (let i = 0; i < 12; i++) {
      const t = i / 11;
      const wobble = Math.sin(i * 1.15 + seed) * (Math.max(prev, curr) * 0.06);
      out.push(Math.max(0, prev + (curr - prev) * t + wobble));
    }
    out[11] = curr;
    return out;
  };
  const seed = rand(storeId + c.key, 5) * 6;
  const leads = step(c.leadsPrev, c.leads, seed);
  const sales = step(c.salesPrev, c.sales, seed + 1.4);
  const spend = step(c.spendPrev, c.spend, seed + 2.6);
  return leads.map((l, i) => ({
    week: `W${i + 1}`,
    leads: Math.round(l),
    sales: Math.round(sales[i] * 10) / 10,
    spend: Math.round(spend[i]),
    close: l > 0 ? (sales[i] / l) * 100 : 0,
    cpl: l > 0 ? spend[i] / l : 0,
  }));
}

/** Network-level channel totals across all stores. */
export function networkChannelTotals(list: DealershipMetrics[]) {
  const base = CHANNEL_ORDER.map((k) => ({
    key: k,
    label: CHANNEL_META[k].label,
    color: CHANNEL_META[k].color,
    spend: 0,
    spendPrev: 0,
    leads: 0,
    leadsPrev: 0,
    sales: 0,
    salesPrev: 0,
  }));
  for (const d of list) {
    const rows = channelBreakdown(d);
    rows.forEach((r, i) => {
      base[i].spend += r.spend;
      base[i].spendPrev += r.spendPrev;
      base[i].leads += r.leads;
      base[i].leadsPrev += r.leadsPrev;
      base[i].sales += r.sales;
      base[i].salesPrev += r.salesPrev;
    });
  }
  const total = base.reduce((a, b) => a + b.spend, 0) || 1;
  return base.map((b) => ({
    ...b,
    share: b.spend / total,
    spendDelta: pctDelta(b.spend, b.spendPrev),
    leadsDelta: pctDelta(b.leads, b.leadsPrev),
    salesDelta: pctDelta(b.sales, b.salesPrev),
    cpl: b.leads > 0 ? b.spend / b.leads : 0,
    cplPrev: b.leadsPrev > 0 ? b.spendPrev / b.leadsPrev : 0,
    cps: b.sales > 0 ? b.spend / b.sales : 0,
    closeRate: b.leads > 0 ? b.sales / b.leads : 0,
    closeRatePrev: b.leadsPrev > 0 ? b.salesPrev / b.leadsPrev : 0,
  }));
}
