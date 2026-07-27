export type Region = "West" | "Prairies" | "Ontario" | "Quebec" | "Atlantic";
export type Brand = string;

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

// Build a 12-point trend interpolating prev -> current leads with slight wobble
const mkTrend = (prev: number, curr: number): number[] => {
  const out: number[] = [];
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    const wobble = Math.sin(i * 1.3) * (prev * 0.04);
    out.push(Math.max(0, Math.round(prev + (curr - prev) * t + wobble)));
  }
  return out;
};

const D = (
  id: string,
  name: string,
  city: string,
  region: Region,
  brand: Brand,
  leads: number,
  leadsPrev: number,
  sales: number,
  salesPrev: number,
  adSpend: number,
  adSpendPrev: number,
): Dealership => ({
  id, name, city, region, brand,
  leads, leadsPrev, sales, salesPrev, adSpend, adSpendPrev,
  trend: mkTrend(leadsPrev, leads),
});

const RAW: Dealership[] = [
  D("d1",  "Parkland Dodge",            "Spruce Grove",   "Prairies", "Dodge",       649, 363, 42, 38, 78000, 52000),
  D("d2",  "Acura of Hamilton",         "Hamilton",       "Ontario",  "Acura",       190, 146, 24, 18, 34000, 28000),
  D("d3",  "Porsche Centre London",     "London",         "Ontario",  "Porsche",     133, 109, 15, 13, 41000, 36000),
  D("d4",  "Dodge City Motors",         "Saskatoon",      "Prairies", "Dodge",       500, 412, 72, 62, 58000, 52000),
  D("d5",  "Tower Chrysler Dodge Jeep", "Calgary",        "Prairies", "Chrysler",    354, 293, 55, 48, 46000, 41000),
  D("d6",  "Courtesy Chrysler",         "Calgary",        "Prairies", "Chrysler",    381, 318, 53, 45, 44000, 39000),
  D("d7",  "Audi Windsor",              "Windsor",        "Ontario",  "Audi",        267, 225, 44, 35, 52000, 46000),
  D("d8",  "Hyatt Infiniti",            "Calgary",        "Prairies", "Infiniti",    297, 253, 52, 44, 48000, 42000),
  D("d9",  "Maple Ridge Volkswagen",    "Maple Ridge",    "West",     "Volkswagen",  528, 451, 82, 55, 64000, 58000),
  D("d10", "Cambridge Hyundai",         "Cambridge",      "Ontario",  "Hyundai",     503, 430, 65, 56, 51000, 45000),
  D("d11", "Planete Mazda",             "Mirabel",        "Quebec",   "Mazda",       387, 334, 95, 67, 42000, 38000),
  D("d12", "Plaza Nissan",              "Hamilton",       "Ontario",  "Nissan",      673, 592, 73, 80, 68000, 62000),
  D("d13", "Rose City Ford",            "Welland",        "Ontario",  "Ford",        746, 682,132,142, 82000, 76000),
  D("d14", "Northland Volkswagen",      "Calgary",        "Prairies", "Volkswagen",  739, 686,107, 64, 74000, 68000),
  D("d15", "401 Dixie Hyundai",         "Mississauga",    "Ontario",  "Hyundai",     412, 388, 35, 40, 46000, 43000),
  D("d16", "London Honda",              "London",         "Ontario",  "Honda",       358, 342, 71, 64, 40000, 38000),
  D("d17", "Sherwood Park Volkswagen",  "Sherwood Park",  "Prairies", "Volkswagen",  221, 210, 49, 45, 32000, 30000),
  D("d18", "BMW Montreal Centre",       "Montreal",       "Quebec",   "BMW",         263, 248, 38, 34, 54000, 50000),
  D("d19", "McNaught Cadillac Buick",   "Winnipeg",       "Prairies", "Cadillac",    198, 211, 37, 48, 44000, 41000),
  D("d20", "St. James Volkswagen",      "Winnipeg",       "Prairies", "Volkswagen",  791, 805,144,107, 68000, 66000),
  D("d21", "Moncton Chrysler",          "Moncton",        "Atlantic", "Chrysler",    301, 293, 40, 41, 36000, 35000),
  D("d22", "Waterloo Honda",            "Waterloo",       "Ontario",  "Honda",       321, 312, 59, 82, 42000, 40000),
  D("d23", "BMW Laval",                 "Laval",          "Quebec",   "BMW",         242, 232, 47, 58, 56000, 52000),
  D("d24", "Crosstown Auto Centre",     "Winnipeg",       "Prairies", "Chrysler",    655, 771,165,141, 71000, 74000),
  D("d25", "Mann-Northway Auto",        "Prince Albert",  "Prairies", "Toyota",      213, 222, 30, 44, 34000, 33000),
  D("d26", "Crowfoot Hyundai",          "Calgary",        "Prairies", "Hyundai",     260, 247, 45, 40, 38000, 36000),
  D("d27", "Guelph Kia",                "Guelph",         "Ontario",  "Kia",         418, 402, 73, 62, 44000, 42000),
  D("d28", "Fish Creek Nissan",         "Calgary",        "Prairies", "Nissan",      467, 452, 80, 68, 48000, 46000),
  D("d29", "Grande Prairie Subaru",     "Grande Prairie", "Prairies", "Subaru",      288, 181, 46, 29, 32000, 24000),
  D("d30", "Wellington Motors",         "Guelph",         "Ontario",  "Chrysler",    312, 305, 55, 43, 38000, 36000),
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
