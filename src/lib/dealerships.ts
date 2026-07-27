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
  leadsDelta: number;
  salesDelta: number;
  closeRateDelta: number;
  adSpendDelta: number;
  cplDelta: number;
  priorityScore: number;
  reasons: string[];
};

const mkTrend = (prev: number, curr: number): number[] => {
  const out: number[] = [];
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    const wobble = Math.sin(i * 1.3) * (prev * 0.04);
    out.push(Math.max(0, Math.round(prev + (curr - prev) * t + wobble)));
  }
  return out;
};

// Deterministic pseudo-random 0..1 from a string seed.
const rand = (seed: string, salt: number) => {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
};

type Meta = { id: string; name: string; city: string; region: Region; brand: Brand };

// Full AutoCanada roster (autocan.ca/dealerships).
const META: Meta[] = [
  { id: "d401dixie",   name: "401 Dixie Hyundai",              city: "Mississauga",   region: "Ontario",  brand: "Hyundai" },
  { id: "d417nissan",  name: "417 Nissan",                     city: "Ottawa",        region: "Ontario",  brand: "Nissan" },
  { id: "dabbvw",      name: "Abbotsford VW",                  city: "Abbotsford",    region: "West",     brand: "Volkswagen" },
  { id: "dacurahm",    name: "Acura of Hamilton",              city: "Hamilton",      region: "Ontario",  brand: "Acura" },
  { id: "daudiwin",    name: "Audi Windsor",                   city: "Windsor",       region: "Ontario",  brand: "Audi" },
  { id: "daudiwpg",    name: "Audi Winnipeg",                  city: "Winnipeg",      region: "Prairies", brand: "Audi" },
  { id: "dbmwmtl",     name: "BMW Montréal Centre",            city: "Montréal",      region: "Quebec",   brand: "BMW" },
  { id: "dbmwlaval",   name: "BMW Laval",                      city: "Laval",         region: "Quebec",   brand: "BMW" },
  { id: "dbranthonda", name: "Brantford Honda",                city: "Brantford",     region: "Ontario",  brand: "Honda" },
  { id: "dsterhonda",  name: "Sterling Honda",                 city: "Hamilton",      region: "Ontario",  brand: "Honda" },
  { id: "dbridgesgm",  name: "Bridges GM",                     city: "North Battleford", region: "Prairies", brand: "GM" },
  { id: "dmrgm",       name: "Maple Ridge GM",                 city: "Pitt Meadows",  region: "West",     brand: "GM" },
  { id: "dcambhy",     name: "Cambridge Hyundai",              city: "Cambridge",     region: "Ontario",  brand: "Hyundai" },
  { id: "dcapdodge",   name: "Capital Dodge Chrysler Jeep RAM", city: "Edmonton",     region: "Prairies", brand: "Chrysler" },
  { id: "dchillvw",    name: "Chilliwack VW",                  city: "Chilliwack",    region: "West",     brand: "Volkswagen" },
  { id: "dcourtesy",   name: "Courtesy Chrysler Dodge Jeep RAM", city: "Calgary",     region: "Prairies", brand: "Chrysler" },
  { id: "dcrosstown",  name: "Crosstown Auto Centre",          city: "Edmonton",      region: "Prairies", brand: "Chrysler" },
  { id: "dcrowhy",     name: "Crowfoot Hyundai",               city: "Calgary",       region: "Prairies", brand: "Hyundai" },
  { id: "ddartcdj",    name: "Dartmouth Chrysler Jeep Dodge",  city: "Dartmouth",     region: "Atlantic", brand: "Chrysler" },
  { id: "ddodgecity",  name: "Dodge City Motors",              city: "Saskatoon",     region: "Prairies", brand: "Dodge" },
  { id: "deastcdj",    name: "Eastern Chrysler Dodge Jeep RAM", city: "Winnipeg",     region: "Prairies", brand: "Chrysler" },
  { id: "dfishcreek",  name: "Fish Creek Nissan",              city: "Calgary",       region: "Prairies", brand: "Nissan" },
  { id: "dgpcdj",      name: "Grande Prairie Chrysler Jeep Dodge", city: "Grande Prairie", region: "Prairies", brand: "Chrysler" },
  { id: "dgphy",       name: "Grande Prairie Hyundai",         city: "Grande Prairie", region: "Prairies", brand: "Hyundai" },
  { id: "dgpnissan",   name: "Grande Prairie Nissan",          city: "Grande Prairie", region: "Prairies", brand: "Nissan" },
  { id: "dgpsubaru",   name: "Grande Prairie Subaru",          city: "Grande Prairie", region: "Prairies", brand: "Subaru" },
  { id: "dgpvw",       name: "Grande Prairie VW",              city: "Grande Prairie", region: "Prairies", brand: "Volkswagen" },
  { id: "dguelphhy",   name: "Guelph Hyundai",                 city: "Guelph",        region: "Ontario",  brand: "Hyundai" },
  { id: "dguelphkia",  name: "Guelph KIA",                     city: "Guelph",        region: "Ontario",  brand: "Kia" },
  { id: "dhuntclub",   name: "Hunt Club Nissan",               city: "Ottawa",        region: "Ontario",  brand: "Nissan" },
  { id: "dhyattinf",   name: "Hyatt INFINITI",                 city: "Calgary",       region: "Prairies", brand: "Infiniti" },
  { id: "dislandgm",   name: "Island GM",                      city: "Duncan",        region: "West",     brand: "GM" },
  { id: "dkiahm",      name: "KIA of Hamilton",                city: "Hamilton",      region: "Ontario",  brand: "Kia" },
  { id: "dlondonhonda", name: "London Honda",                  city: "London",        region: "Ontario",  brand: "Honda" },
  { id: "dlondoninf",  name: "London INFINITI",                city: "London",        region: "Ontario",  brand: "Infiniti" },
  { id: "dlondonkia",  name: "London KIA",                     city: "London",        region: "Ontario",  brand: "Kia" },
  { id: "dmannnw",     name: "Mann Northway",                  city: "Prince Albert", region: "Prairies", brand: "GM" },
  { id: "dmrcdj",      name: "Maple Ridge Chrysler Jeep Dodge", city: "Maple Ridge",  region: "West",     brand: "Chrysler" },
  { id: "dmrvw",       name: "Maple Ridge VW",                 city: "Maple Ridge",   region: "West",     brand: "Volkswagen" },
  { id: "dmcngmc",     name: "McNaught Buick GMC",             city: "Winnipeg",      region: "Prairies", brand: "GMC" },
  { id: "dmcncad",     name: "McNaught Cadillac",              city: "Winnipeg",      region: "Prairies", brand: "Cadillac" },
  { id: "dnursechev",  name: "Nurse Chevrolet",                city: "Whitby",        region: "Ontario",  brand: "Chevrolet" },
  { id: "dnursecad",   name: "Nurse Cadillac",                 city: "Whitby",        region: "Ontario",  brand: "Cadillac" },
  { id: "dpremchev",   name: "Premier Chevrolet",              city: "Windsor",       region: "Ontario",  brand: "Chevrolet" },
  { id: "dpremcad",    name: "Premier Cadillac",               city: "Windsor",       region: "Ontario",  brand: "Cadillac" },
  { id: "dmbhv",       name: "Mercedes-Benz Heritage Valley",  city: "Edmonton",      region: "Prairies", brand: "Mercedes-Benz" },
  { id: "dmbrs",       name: "Mercedes-Benz Rive-Sud",         city: "Greenfield Park", region: "Quebec", brand: "Mercedes-Benz" },
  { id: "dminilaval",  name: "MINI Laval",                     city: "Laval",         region: "Quebec",   brand: "Mini" },
  { id: "dminimtl",    name: "MINI Montreal Centre",           city: "Montréal",      region: "Quebec",   brand: "Mini" },
  { id: "dmoncton",    name: "Moncton Chrysler Jeep Dodge",    city: "Moncton",       region: "Atlantic", brand: "Chrysler" },
  { id: "dnlcdj",      name: "Northland Chrysler Jeep Dodge",  city: "Prince George", region: "West",     brand: "Chrysler" },
  { id: "dnlhy",       name: "Northland Hyundai",              city: "Prince George", region: "West",     brand: "Hyundai" },
  { id: "dnlnissan",   name: "Northland Nissan",               city: "Prince George", region: "West",     brand: "Nissan" },
  { id: "dnlvw",       name: "Northland VW",                   city: "Calgary",       region: "Prairies", brand: "Volkswagen" },
  { id: "dparkland",   name: "Parkland Dodge",                 city: "Spruce Grove",  region: "Prairies", brand: "Dodge" },
  { id: "dplanete",    name: "Planète Mazda",                  city: "Mirabel",       region: "Quebec",   brand: "Mazda" },
  { id: "dplaza",      name: "Plaza Nissan",                   city: "Hamilton",      region: "Ontario",  brand: "Nissan" },
  { id: "dlondporsche", name: "London Porsche",                city: "London",        region: "Ontario",  brand: "Porsche" },
  { id: "drosecity",   name: "Rose City Ford",                 city: "Windsor",       region: "Ontario",  brand: "Ford" },
  { id: "dkelleher",   name: "Kelleher Ford",                  city: "Brandon",       region: "Prairies", brand: "Ford" },
  { id: "dsmp",        name: "Saskatoon Motor Products",       city: "Saskatoon",     region: "Prairies", brand: "Chevrolet" },
  { id: "dsphy",       name: "Sherwood Park Hyundai",          city: "Sherwood Park", region: "Prairies", brand: "Hyundai" },
  { id: "dspvw",       name: "Sherwood Park Volkswagen",       city: "Sherwood Park", region: "Prairies", brand: "Volkswagen" },
  { id: "dslnissan",   name: "South London Nissan",            city: "London",        region: "Ontario",  brand: "Nissan" },
  { id: "dsjvw",       name: "St. James Volkswagen",           city: "Winnipeg",      region: "Prairies", brand: "Volkswagen" },
  { id: "dsubaruhm",   name: "Subaru of Hamilton",             city: "Hamilton",      region: "Ontario",  brand: "Subaru" },
  { id: "dtower",      name: "Tower Chrysler Dodge Jeep RAM",  city: "Calgary",       region: "Prairies", brand: "Chrysler" },
  { id: "dwaterloo",   name: "Waterloo Honda",                 city: "Waterloo",      region: "Ontario",  brand: "Honda" },
  { id: "dwellington", name: "Wellington Motors",              city: "Guelph",        region: "Ontario",  brand: "Chrysler" },
];

// Metrics captured from the Tableau screenshots for these stores. Everything
// else is generated deterministically so the whole 69-store roster renders.
type MetricTuple = [number, number, number, number, number, number];
const OVERRIDES: Record<string, MetricTuple> = {
  dparkland:    [649, 363, 42, 38, 78000, 52000],
  dacurahm:     [190, 146, 24, 18, 34000, 28000],
  dlondporsche: [133, 109, 15, 13, 41000, 36000],
  ddodgecity:   [500, 412, 72, 62, 58000, 52000],
  dtower:       [354, 293, 55, 48, 46000, 41000],
  dcourtesy:    [381, 318, 53, 45, 44000, 39000],
  daudiwin:     [267, 225, 44, 35, 52000, 46000],
  dhyattinf:    [297, 253, 52, 44, 48000, 42000],
  dmrvw:        [528, 451, 82, 55, 64000, 58000],
  dcambhy:      [503, 430, 65, 56, 51000, 45000],
  dplanete:     [387, 334, 95, 67, 42000, 38000],
  dplaza:       [673, 592, 73, 80, 68000, 62000],
  drosecity:    [746, 682, 132, 142, 82000, 76000],
  dnlvw:        [739, 686, 107, 64, 74000, 68000],
  d401dixie:    [412, 388, 35, 40, 46000, 43000],
  dlondonhonda: [358, 342, 71, 64, 40000, 38000],
  dspvw:        [221, 210, 49, 45, 32000, 30000],
  dbmwmtl:      [263, 248, 38, 34, 54000, 50000],
  dmcncad:      [198, 211, 37, 48, 44000, 41000],
  dsjvw:        [791, 805, 144, 107, 68000, 66000],
  dmoncton:     [301, 293, 40, 41, 36000, 35000],
  dwaterloo:    [321, 312, 59, 82, 42000, 40000],
  dbmwlaval:    [242, 232, 47, 58, 56000, 52000],
  dcrosstown:   [655, 771, 165, 141, 71000, 74000],
  dmannnw:      [213, 222, 30, 44, 34000, 33000],
  dcrowhy:      [260, 247, 45, 40, 38000, 36000],
  dguelphkia:   [418, 402, 73, 62, 44000, 42000],
  dfishcreek:   [467, 452, 80, 68, 48000, 46000],
  dgpsubaru:    [288, 181, 46, 29, 32000, 24000],
  dwellington:  [312, 305, 55, 43, 38000, 36000],
};

const gen = (id: string): MetricTuple => {
  const leadsPrev = 140 + Math.floor(rand(id, 1) * 620);
  const leadsDelta = (rand(id, 2) - 0.5) * 0.5; // -25%..+25%
  const leads = Math.max(30, Math.round(leadsPrev * (1 + leadsDelta)));
  const closeRate = 0.10 + rand(id, 3) * 0.15; // 10-25%
  const salesPrev = Math.max(4, Math.round(leadsPrev * closeRate));
  const closeShift = (rand(id, 4) - 0.5) * 0.08;
  const sales = Math.max(3, Math.round(leads * (closeRate + closeShift)));
  const cpl = 90 + rand(id, 5) * 160;
  const adSpendPrev = Math.round(leadsPrev * cpl);
  const adSpend = Math.round(leads * cpl * (1 + (rand(id, 6) - 0.4) * 0.3));
  return [leads, leadsPrev, sales, salesPrev, adSpend, adSpendPrev];
};

const RAW: Dealership[] = META.map((m) => {
  const [leads, leadsPrev, sales, salesPrev, adSpend, adSpendPrev] =
    OVERRIDES[m.id] ?? gen(m.id);
  return {
    ...m,
    leads, leadsPrev, sales, salesPrev, adSpend, adSpendPrev,
    trend: mkTrend(leadsPrev, leads),
  };
});

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
      closeRate, closeRatePrev, cpl, cplPrev, cps, cpsPrev,
      leadsDelta: pctDelta(d.leads, d.leadsPrev),
      salesDelta: pctDelta(d.sales, d.salesPrev),
      closeRateDelta: closeRate - closeRatePrev,
      adSpendDelta: pctDelta(d.adSpend, d.adSpendPrev),
      cplDelta: pctDelta(cpl, cplPrev),
    };
  });

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
    leads, leadsPrev, leadsDelta: pctDelta(leads, leadsPrev),
    sales, salesPrev, salesDelta: pctDelta(sales, salesPrev),
    adSpend, adSpendPrev, adSpendDelta: pctDelta(adSpend, adSpendPrev),
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
