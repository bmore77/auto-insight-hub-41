export type Region = "West" | "Prairies" | "Ontario" | "Quebec" | "Atlantic";
export type Brand =
  | "Toyota"
  | "Honda"
  | "Ford"
  | "Chevrolet"
  | "Hyundai"
  | "Kia"
  | "Nissan"
  | "Mazda"
  | "BMW"
  | "Audi"
  | "Volkswagen"
  | "Subaru";

export type Dealership = {
  id: string;
  name: string;
  city: string;
  region: Region;
  brand: Brand;
  leads: number;
  leadsPrev: number;
  sales: number;
  salesPrev: number;
  adSpend: number;
  adSpendPrev: number;
  /** 12-point weekly leads trend for sparkline */
  trend: number[];
};

export type DealershipMetrics = Dealership & {
  closeRate: number;
  closeRatePrev: number;
  cpl: number;
  cplPrev: number;
  cps: number;
  cpsPrev: number;
  leadsDelta: number; // pct
  salesDelta: number;
  closeRateDelta: number; // pt (absolute)
  adSpendDelta: number;
  cplDelta: number;
  priorityScore: number; // 0-100
  reasons: string[];
};

const RAW: Dealership[] = [
  { id: "d1", name: "Auto Canada Vancouver", city: "Vancouver", region: "West", brand: "Toyota", leads: 412, leadsPrev: 578, sales: 74, salesPrev: 112, adSpend: 82000, adSpendPrev: 71000, trend: [58,54,52,49,46,44,40,38,36,34,33,31] },
  { id: "d2", name: "Auto Canada Calgary North", city: "Calgary", region: "Prairies", brand: "Ford", leads: 356, leadsPrev: 402, sales: 68, salesPrev: 82, adSpend: 61000, adSpendPrev: 58000, trend: [40,39,38,36,35,34,33,32,31,30,29,28] },
  { id: "d3", name: "Auto Canada Edmonton West", city: "Edmonton", region: "Prairies", brand: "Chevrolet", leads: 289, leadsPrev: 421, sales: 41, salesPrev: 74, adSpend: 74000, adSpendPrev: 68000, trend: [42,40,38,36,34,32,30,28,26,25,24,23] },
  { id: "d4", name: "Auto Canada Mississauga", city: "Mississauga", region: "Ontario", brand: "Honda", leads: 498, leadsPrev: 512, sales: 96, salesPrev: 94, adSpend: 68000, adSpendPrev: 69500, trend: [50,51,50,52,49,51,50,49,50,51,52,50] },
  { id: "d5", name: "Auto Canada Ottawa", city: "Ottawa", region: "Ontario", brand: "Hyundai", leads: 322, leadsPrev: 348, sales: 58, salesPrev: 61, adSpend: 44000, adSpendPrev: 46000, trend: [36,35,35,34,33,33,32,32,31,31,30,30] },
  { id: "d6", name: "Auto Canada Toronto East", city: "Toronto", region: "Ontario", brand: "Kia", leads: 275, leadsPrev: 391, sales: 44, salesPrev: 72, adSpend: 59000, adSpendPrev: 52000, trend: [40,38,36,34,32,31,29,28,27,26,25,24] },
  { id: "d7", name: "Auto Canada Montreal", city: "Montreal", region: "Quebec", brand: "Nissan", leads: 384, leadsPrev: 372, sales: 72, salesPrev: 68, adSpend: 51000, adSpendPrev: 49500, trend: [38,38,39,39,40,40,41,41,41,42,42,42] },
  { id: "d8", name: "Auto Canada Quebec City", city: "Quebec City", region: "Quebec", brand: "Mazda", leads: 218, leadsPrev: 296, sales: 38, salesPrev: 56, adSpend: 38000, adSpendPrev: 34000, trend: [30,29,28,27,26,25,24,23,22,22,21,21] },
  { id: "d9", name: "Auto Canada Halifax", city: "Halifax", region: "Atlantic", brand: "Subaru", leads: 189, leadsPrev: 211, sales: 34, salesPrev: 39, adSpend: 29000, adSpendPrev: 27500, trend: [22,21,21,20,20,19,19,19,18,18,18,17] },
  { id: "d10", name: "Auto Canada Victoria", city: "Victoria", region: "West", brand: "BMW", leads: 156, leadsPrev: 168, sales: 32, salesPrev: 33, adSpend: 41000, adSpendPrev: 39000, trend: [17,17,16,16,16,15,15,15,15,15,14,14] },
  { id: "d11", name: "Auto Canada Winnipeg", city: "Winnipeg", region: "Prairies", brand: "Volkswagen", leads: 241, leadsPrev: 268, sales: 42, salesPrev: 49, adSpend: 36000, adSpendPrev: 35000, trend: [28,27,26,26,25,25,24,24,23,23,22,22] },
  { id: "d12", name: "Auto Canada Saskatoon", city: "Saskatoon", region: "Prairies", brand: "Toyota", leads: 198, leadsPrev: 224, sales: 39, salesPrev: 44, adSpend: 32000, adSpendPrev: 31000, trend: [23,23,22,22,21,21,20,20,20,19,19,19] },
  { id: "d13", name: "Auto Canada London", city: "London", region: "Ontario", brand: "Audi", leads: 172, leadsPrev: 234, sales: 28, salesPrev: 46, adSpend: 47000, adSpendPrev: 42000, trend: [25,24,23,22,21,20,19,19,18,17,17,16] },
  { id: "d14", name: "Auto Canada Hamilton", city: "Hamilton", region: "Ontario", brand: "Ford", leads: 267, leadsPrev: 259, sales: 51, salesPrev: 48, adSpend: 42000, adSpendPrev: 41500, trend: [26,26,27,27,27,28,28,28,29,29,29,30] },
  { id: "d15", name: "Auto Canada Kelowna", city: "Kelowna", region: "West", brand: "Honda", leads: 148, leadsPrev: 152, sales: 29, salesPrev: 30, adSpend: 26000, adSpendPrev: 25500, trend: [16,16,16,15,15,16,16,16,15,15,16,16] },
  { id: "d16", name: "Auto Canada St. John's", city: "St. John's", region: "Atlantic", brand: "Nissan", leads: 132, leadsPrev: 178, sales: 22, salesPrev: 33, adSpend: 24000, adSpendPrev: 22000, trend: [19,18,18,17,16,15,15,14,14,13,13,12] },
];

const pctDelta = (curr: number, prev: number) => (prev === 0 ? 0 : (curr - prev) / prev);

export function computeMetrics(list: Dealership[] = RAW): DealershipMetrics[] {
  const enriched = list.map((d) => {
    const closeRate = d.leads > 0 ? d.sales / d.leads : 0;
    const closeRatePrev = d.leadsPrev > 0 ? d.salesPrev / d.leadsPrev : 0;
    const cpl = d.leads > 0 ? d.adSpend / d.leads : 0;
    const cplPrev = d.leadsPrev > 0 ? d.adSpendPrev / d.leadsPrev : 0;
    const cps = d.sales > 0 ? d.adSpend / d.sales : 0;
    const cpsPrev = d.salesPrev > 0 ? d.adSpendPrev / d.salesPrev : 0;
    return {
      ...d,
      closeRate,
      closeRatePrev,
      cpl,
      cplPrev,
      cps,
      cpsPrev,
      leadsDelta: pctDelta(d.leads, d.leadsPrev),
      salesDelta: pctDelta(d.sales, d.salesPrev),
      closeRateDelta: closeRate - closeRatePrev,
      adSpendDelta: pctDelta(d.adSpend, d.adSpendPrev),
      cplDelta: pctDelta(cpl, cplPrev),
    };
  });

  // sub-scores 0-100 based on how bad each store is relative to network
  const leadDrops = enriched.map((e) => Math.max(0, -e.leadsDelta));
  const salesDrops = enriched.map((e) => Math.max(0, -e.salesDelta));
  const closeDrops = enriched.map((e) => Math.max(0, -e.closeRateDelta));
  const cplUps = enriched.map((e) => Math.max(0, e.cplDelta));

  const norm = (v: number, arr: number[]) => {
    const max = Math.max(...arr, 0.0001);
    return (v / max) * 100;
  };

  return enriched.map((e, i) => {
    const leadsScore = norm(leadDrops[i], leadDrops);
    const salesScore = norm(salesDrops[i], salesDrops);
    const closeScore = norm(closeDrops[i], closeDrops);
    const cplScore = norm(cplUps[i], cplUps);
    const priorityScore =
      0.55 * leadsScore + 0.2 * salesScore + 0.15 * closeScore + 0.1 * cplScore;

    const reasons: string[] = [];
    if (e.leadsDelta <= -0.05)
      reasons.push(`Leads ▼ ${Math.abs(e.leadsDelta * 100).toFixed(0)}%`);
    if (e.salesDelta <= -0.05)
      reasons.push(`Sales ▼ ${Math.abs(e.salesDelta * 100).toFixed(0)}%`);
    if (e.closeRateDelta <= -0.01)
      reasons.push(`Close % ▼ ${Math.abs(e.closeRateDelta * 100).toFixed(1)}pt`);
    if (e.cplDelta >= 0.1)
      reasons.push(`CPL ▲ ${(e.cplDelta * 100).toFixed(0)}%`);

    return { ...e, priorityScore, reasons };
  });
}

export function networkTotals(m: DealershipMetrics[]) {
  const sum = (k: keyof DealershipMetrics) => m.reduce((a, d) => a + (d[k] as number), 0);
  const leads = sum("leads");
  const leadsPrev = sum("leadsPrev");
  const sales = sum("sales");
  const salesPrev = sum("salesPrev");
  const adSpend = sum("adSpend");
  const adSpendPrev = sum("adSpendPrev");
  return {
    leads,
    leadsPrev,
    leadsDelta: pctDelta(leads, leadsPrev),
    sales,
    salesPrev,
    salesDelta: pctDelta(sales, salesPrev),
    adSpend,
    adSpendPrev,
    adSpendDelta: pctDelta(adSpend, adSpendPrev),
    closeRate: leads > 0 ? sales / leads : 0,
    closeRatePrev: leadsPrev > 0 ? salesPrev / leadsPrev : 0,
    cpl: leads > 0 ? adSpend / leads : 0,
    cplPrev: leadsPrev > 0 ? adSpendPrev / leadsPrev : 0,
    cps: sales > 0 ? adSpend / sales : 0,
    cpsPrev: salesPrev > 0 ? adSpendPrev / salesPrev : 0,
  };
}

export const formatCurrency = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`;
export const formatPct = (n: number, digits = 1) => `${(n * 100).toFixed(digits)}%`;
export const formatDelta = (n: number, digits = 1) =>
  `${n >= 0 ? "+" : ""}${(n * 100).toFixed(digits)}%`;
export const formatDeltaPt = (n: number, digits = 1) =>
  `${n >= 0 ? "+" : ""}${(n * 100).toFixed(digits)}pt`;
