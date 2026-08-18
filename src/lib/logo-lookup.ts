/**
 * Store logo lookup.
 *
 * Each dealership resolves to a domain (its own site when we know it, otherwise
 * the OEM brand site) and the logo is fetched from Logo.dev's image CDN.
 * Results are cached two ways so repeat renders are instant:
 *   1. an in-memory Map for the current session
 *   2. localStorage, so a known-good / known-missing domain never re-flashes
 *      the monogram fallback on the next page load
 */

const TOKEN = import.meta.env['VITE_LOVABLE_CONNECTOR_LOGO_DEV_API_KEY'] as
  | string
  | undefined;

const CACHE_KEY = "ac-logo-cache-v1";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

export type LogoState = "ok" | "missing";

type CacheEntry = { s: LogoState; t: number };

const memory = new Map<string, LogoState>();
let hydrated = false;

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, CacheEntry>;
    const now = Date.now();
    for (const [domain, entry] of Object.entries(parsed)) {
      if (entry && now - entry.t < CACHE_TTL_MS) memory.set(domain, entry.s);
    }
  } catch {
    /* corrupt cache — start clean */
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    const now = Date.now();
    const out: Record<string, CacheEntry> = {};
    for (const [domain, s] of memory) out[domain] = { s, t: now };
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(out));
  } catch {
    /* quota / private mode — cache is best-effort */
  }
}

export function getCachedLogoState(domain: string): LogoState | undefined {
  hydrate();
  return memory.get(domain);
}

export function setCachedLogoState(domain: string, state: LogoState) {
  hydrate();
  if (memory.get(domain) === state) return;
  memory.set(domain, state);
  persist();
}

/** OEM brand domains — the reliable fallback for every store. */
const BRAND_DOMAIN: Record<string, string> = {
  Acura: "acura.ca",
  Audi: "audi.ca",
  BMW: "bmw.ca",
  Cadillac: "cadillaccanada.ca",
  Chevrolet: "chevrolet.ca",
  Chrysler: "chrysler.ca",
  Dodge: "dodge.ca",
  Ford: "ford.ca",
  GM: "gm.ca",
  GMC: "gmc.ca",
  Honda: "honda.ca",
  Hyundai: "hyundaicanada.com",
  Infiniti: "infiniti.ca",
  Kia: "kia.ca",
  Mazda: "mazda.ca",
  "Mercedes-Benz": "mercedes-benz.ca",
  Mini: "mini.ca",
  Nissan: "nissan.ca",
  Porsche: "porsche.com",
  Subaru: "subaru.ca",
  Volkswagen: "vw.ca",
};

/** Known dealership-specific sites; these win over the brand domain. */
const STORE_DOMAIN: Record<string, string> = {
  d401dixie: "401dixiehyundai.com",
  dparkland: "parklanddodge.com",
  dcourtesy: "courtesychrysler.com",
  dcrosstown: "crosstownauto.net",
  ddodgecity: "dodgecity.ca",
  dtower: "towerchrysler.com",
  dcapdodge: "capitaldodge.ca",
  dfishcreek: "fishcreeknissan.ca",
  dcrowhy: "crowfoothyundai.com",
  dhyattinf: "hyattinfiniti.com",
  dsmp: "saskatoonmotorproducts.com",
  drosecity: "rosecityford.com",
  dkelleher: "kelleherford.com",
  dwaterloo: "waterloohonda.com",
  dlondonhonda: "londonhonda.com",
  dguelphkia: "guelphkia.com",
  dcambhy: "cambridgehyundai.com",
  dplaza: "plazanissan.ca",
  dwellington: "wellingtonmotors.ca",
  dsjvw: "stjamesvolkswagen.com",
  dmcncad: "mcnaughtcadillac.com",
  dmcngmc: "mcnaughtbuickgmc.com",
  dmannnw: "mannnorthway.com",
  dgpsubaru: "grandeprairiesubaru.com",
  dnlvw: "northlandvw.ca",
  dspvw: "sherwoodparkvw.com",
  dmrvw: "mapleridgevw.com",
  dbmwmtl: "bmwmontrealcentre.ca",
  dbmwlaval: "bmwlaval.ca",
  dplanete: "planetemazda.com",
  dmoncton: "monctonchrysler.com",
  dlondporsche: "porschelondon.ca",
  dacurahm: "acuraofhamilton.com",
  daudiwin: "audiwindsor.com",
};

/** Resolve the best-known domain for a store. */
export function logoDomain(brand: string, storeId?: string): string | null {
  if (storeId && STORE_DOMAIN[storeId]) return STORE_DOMAIN[storeId];
  return BRAND_DOMAIN[brand] ?? null;
}

/** Logo.dev image URL for a domain, or null when lookup isn't configured. */
export function logoUrl(domain: string, size: number): string | null {
  if (!TOKEN) return null;
  return `https://img.logo.dev/${domain}?token=${TOKEN}&size=${size * 2}&format=png&retina=true`;
}
