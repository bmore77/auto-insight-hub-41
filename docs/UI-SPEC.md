# AutoCanada Dealership Priority Dashboard — UI Recreation Spec

Purpose: give an engineering team everything needed to rebuild this app's **user interface** in their own environment, wired to their own data. This document covers design tokens, typography, layout, component anatomy, states, interactions, and the data shape each view expects. Business/data plumbing is described only as the contract the UI consumes.

---

## 1. Stack assumptions

| Concern | Choice |
| --- | --- |
| Framework | React 19 + TypeScript |
| Router | TanStack Router (file-based, `src/routes/*`) — any router works; routes below are paths |
| Styling | Tailwind CSS **v4** (CSS-first config in `src/styles.css`; no `tailwind.config.js`) |
| Components | shadcn/ui (Radix primitives) — select, sheet, tabs, table, input, textarea, badge, button, progress, sonner toasts |
| Charts | Recharts 2.x (`LineChart`, `AreaChart`, `BarChart`, `ResponsiveContainer`) |
| Icons | `lucide-react` |
| Fonts | Google Fonts: Sora, Manrope, JetBrains Mono |

Hard rules:
- **No emojis anywhere in the UI.**
- **No hardcoded color utilities** (`text-white`, `bg-black`, `bg-[#hex]`). Everything goes through semantic tokens. Exception: fixed third-party brand colors for channel/OEM marks, defined in one constants file.
- Numbers use tabular figures (`.num` utility) so columns don't jitter.

---

## 2. Design system

### 2.1 Typography

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" />
```

| Role | Family | Usage |
| --- | --- | --- |
| Display / headings (`--font-display`) | **Sora** | h1–h4, page titles, KPI values, score numerals |
| Body / UI (`--font-sans`) | **Manrope** | everything else |
| Numeric / code (`--font-mono`) | **JetBrains Mono** | IDs, raw parsed values, JSON blocks |

Heading treatment: `letter-spacing: -0.025em`, weight 600. Page h1 is 28–38px. Section h2 is `text-lg font-semibold tracking-tight`. Card h3 is `text-sm font-medium tracking-tight`. Table headers are `text-[11px] uppercase tracking-wider text-muted-foreground`.

### 2.2 Color tokens (`src/styles.css`)

All colors are **oklch**. Light values in `:root`, dark in `.dark`, mapped into Tailwind via `@theme inline`.

```css
@import "tailwindcss" source(none);
@source "../src";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --font-sans: "Manrope", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Sora", "Manrope", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;

  --color-brand: var(--brand);
  --color-brand-soft: var(--brand-soft);
  --color-brand-blue: var(--brand-blue);
  --color-brand-blue-soft: var(--brand-blue-soft);
  --color-success: var(--success);
  --color-success-soft: var(--success-soft);
  --color-success-border: var(--success-border);
  --color-warning: var(--warning);
  --color-warning-soft: var(--warning-soft);
  --color-warning-border: var(--warning-border);
  --color-danger: var(--danger);
  --color-danger-soft: var(--danger-soft);
  --color-danger-border: var(--danger-border);
  --color-surface: var(--surface);
  --color-surface-muted: var(--surface-muted);
  /* plus the standard shadcn map: background, foreground, card, popover,
     primary, secondary, muted, accent, destructive, border, input, ring,
     chart-1..5, sidebar-* */

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --radius-2xl: calc(var(--radius) + 8px);
  --radius-3xl: calc(var(--radius) + 12px);
}
```

Light theme values:

```css
:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.16 0.03 258);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.16 0.03 258);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.16 0.03 258);

  /* AutoCanada brand */
  --brand: oklch(0.55 0.22 27);          /* AutoCanada red */
  --brand-soft: oklch(0.96 0.035 27);
  --brand-blue: oklch(0.38 0.13 258);    /* deep blue */
  --brand-blue-soft: oklch(0.955 0.03 258);

  --primary: oklch(0.55 0.22 27);
  --primary-foreground: oklch(0.99 0.005 258);
  --secondary: oklch(0.965 0.008 258);
  --secondary-foreground: oklch(0.38 0.13 258);
  --muted: oklch(0.966 0.008 258);
  --muted-foreground: oklch(0.53 0.035 258);
  --accent: oklch(0.955 0.03 258);
  --accent-foreground: oklch(0.38 0.13 258);
  --destructive: oklch(0.55 0.22 27);
  --border: oklch(0.918 0.012 258);
  --input: oklch(0.918 0.012 258);
  --ring: oklch(0.55 0.22 27);

  --chart-1: oklch(0.55 0.22 27);
  --chart-2: oklch(0.38 0.13 258);
  --chart-3: oklch(0.62 0.14 250);
  --chart-4: oklch(0.7 0.16 35);
  --chart-5: oklch(0.58 0.13 158);

  /* surfaces + status */
  --surface: oklch(0.995 0.002 250);
  --surface-muted: oklch(0.977 0.004 250);
  --success: oklch(0.58 0.13 158);
  --success-soft: oklch(0.965 0.03 158);
  --success-border: oklch(0.88 0.06 158);
  --warning: oklch(0.63 0.14 70);
  --warning-soft: oklch(0.97 0.04 82);
  --warning-border: oklch(0.88 0.08 82);
  --danger: oklch(0.58 0.19 18);
  --danger-soft: oklch(0.966 0.02 18);
  --danger-border: oklch(0.88 0.06 18);

  --shadow-soft: 0 1px 2px oklch(0.2 0.04 265 / 0.05), 0 8px 24px -14px oklch(0.2 0.04 265 / 0.18);
  --shadow-raised: 0 1px 2px oklch(0.2 0.04 265 / 0.06), 0 18px 40px -22px oklch(0.2 0.04 265 / 0.3);
  --gradient-page:
    radial-gradient(900px 420px at 12% -180px, oklch(0.55 0.22 27 / 0.1), transparent 70%),
    radial-gradient(1100px 460px at 82% -200px, oklch(0.38 0.13 258 / 0.12), transparent 70%);
  --gradient-brand: linear-gradient(120deg, oklch(0.55 0.22 27), oklch(0.38 0.13 258));
}
```

Dark theme values:

```css
.dark {
  --background: oklch(0.16 0.03 258);
  --foreground: oklch(0.98 0.004 258);
  --card: oklch(0.21 0.035 258);
  --popover: oklch(0.21 0.035 258);
  --brand: oklch(0.66 0.2 27);
  --brand-soft: oklch(0.3 0.08 27);
  --brand-blue: oklch(0.62 0.14 258);
  --brand-blue-soft: oklch(0.28 0.07 258);
  --primary: oklch(0.66 0.2 27);
  --secondary: oklch(0.28 0.04 258);
  --muted: oklch(0.28 0.04 258);
  --muted-foreground: oklch(0.72 0.03 258);
  --accent: oklch(0.28 0.04 258);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.66 0.2 27);
  --surface: oklch(0.2 0.04 265);
  --surface-muted: oklch(0.24 0.04 262);
  --success: oklch(0.75 0.15 158);
  --success-soft: oklch(0.28 0.05 158);
  --success-border: oklch(0.4 0.08 158);
  --warning: oklch(0.8 0.14 82);
  --warning-soft: oklch(0.3 0.05 82);
  --warning-border: oklch(0.44 0.08 82);
  --danger: oklch(0.72 0.17 18);
  --danger-soft: oklch(0.29 0.06 18);
  --danger-border: oklch(0.44 0.1 18);
  --shadow-soft: 0 1px 2px oklch(0 0 0 / 0.4), 0 10px 30px -18px oklch(0 0 0 / 0.7);
  --shadow-raised: 0 1px 2px oklch(0 0 0 / 0.45), 0 24px 48px -24px oklch(0 0 0 / 0.8);
  --gradient-page:
    radial-gradient(900px 420px at 12% -180px, oklch(0.66 0.2 27 / 0.16), transparent 70%),
    radial-gradient(1100px 460px at 82% -200px, oklch(0.62 0.14 258 / 0.16), transparent 70%);
  --gradient-brand: linear-gradient(120deg, oklch(0.66 0.2 27), oklch(0.62 0.14 258));
}
```

Semantic usage:
- **brand red** — primary actions, active nav, priority accents, brand gradient text.
- **brand blue** — secondary/structural accents, second chart series.
- **success / warning / danger** — deltas and status. Green = good direction, amber = watch, red = bad direction. Direction is metric-dependent (see §2.5).

### 2.3 Custom utilities (Tailwind v4 `@utility`)

```css
@utility font-display   { font-family: var(--font-display); }
@utility bg-brand-gradient { background-image: var(--gradient-brand); }
@utility text-gradient-brand {
  background-image: var(--gradient-brand);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
@utility page-canvas { background-image: var(--gradient-page); background-repeat: no-repeat; }
@utility shadow-soft   { box-shadow: var(--shadow-soft); }
@utility shadow-raised { box-shadow: var(--shadow-raised); }
@utility num { font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }

/* Frosted card surface */
@utility glass {
  background: color-mix(in oklab, var(--card) 78%, transparent);
  backdrop-filter: blur(16px) saturate(140%);
  -webkit-backdrop-filter: blur(16px) saturate(140%);
  box-shadow: inset 0 1px 0 color-mix(in oklab, white 55%, transparent), var(--shadow-soft);
}

/* Hover lift for interactive cards */
@utility lift {
  transition: transform .35s cubic-bezier(.22,1,.36,1), box-shadow .35s ease, border-color .35s ease;
  &:hover {
    transform: translateY(-3px);
    box-shadow: var(--shadow-raised);
    border-color: color-mix(in oklab, var(--brand) 28%, var(--border));
  }
}

/* 1px brand hairline along a card's top edge */
@utility edge-brand {
  position: relative;
  &::before {
    content: ""; position: absolute; inset-inline: 0; top: 0; height: 1px;
    background: var(--gradient-brand); opacity: .65;
  }
}

/* Cursor-follow glow; set --mx/--my inline from onMouseMove */
@utility spotlight {
  position: relative; isolation: isolate;
  &::after {
    content: ""; position: absolute; inset: 0; border-radius: inherit;
    background: radial-gradient(340px circle at var(--mx,50%) var(--my,0%),
      color-mix(in oklab, var(--brand) 14%, transparent), transparent 65%);
    opacity: 0; transition: opacity .35s ease; pointer-events: none; z-index: -1;
  }
  &:hover::after { opacity: 1; }
}

/* Ambient animated aurora behind hero blocks */
@utility aurora {
  position: relative; overflow: hidden;
  &::before {
    content: ""; position: absolute; inset: -40%;
    background:
      radial-gradient(closest-side, color-mix(in oklab, var(--brand) 26%, transparent), transparent),
      radial-gradient(closest-side at 70% 60%, color-mix(in oklab, var(--brand-blue) 28%, transparent), transparent);
    filter: blur(42px); animation: ac-aurora 18s ease-in-out infinite;
    pointer-events: none; opacity: .55;
  }
}

@utility animate-fade-up   { animation: ac-fade-up .5s cubic-bezier(.22,1,.36,1) both; }
@utility animate-pulse-ring{ animation: ac-pulse-ring 2.4s ease-out infinite; }
@utility shimmer {
  background-image: linear-gradient(90deg, transparent,
    color-mix(in oklab, var(--brand) 12%, transparent), transparent);
  background-size: 200% 100%; animation: ac-shimmer 2.2s linear infinite;
}
```

Keyframes:

```css
@keyframes ac-fade-up { from { opacity:0; transform:translateY(10px);} to { opacity:1; transform:none;} }
@keyframes ac-shimmer { 0% { background-position:-200% 0;} 100% { background-position:200% 0;} }
@keyframes ac-pulse-ring {
  0%,100% { box-shadow: 0 0 0 0 color-mix(in oklab, var(--brand) 35%, transparent); }
  50%     { box-shadow: 0 0 0 8px color-mix(in oklab, var(--brand) 0%, transparent); }
}
@keyframes ac-aurora {
  0%   { transform: translate3d(-6%,-4%,0) scale(1); }
  50%  { transform: translate3d(6%,4%,0) scale(1.12); }
  100% { transform: translate3d(-6%,-4%,0) scale(1); }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .001ms !important;
  }
}
```

Base layer:

```css
@layer base {
  * { border-color: var(--color-border); }
  body { background-color: var(--color-background); color: var(--color-foreground);
         font-family: var(--font-sans); -webkit-font-smoothing: antialiased; }
  h1,h2,h3,h4 { font-family: var(--font-display); letter-spacing: -0.025em; }
}
```

### 2.4 Spacing, radius, elevation

- Page container: `mx-auto max-w-[1400px] px-8 py-10`.
- Section rhythm: `mb-10` / `mb-12` between major sections; `mb-4` between a section header and its content.
- Cards: `rounded-2xl border border-border/60 bg-card shadow-soft`; interactive cards add `lift spotlight`; hero blocks add `aurora rounded-3xl`.
- Pills/chips: `rounded-full border px-2.5 py-1 text-[11px]`.
- Inputs/selects/buttons in toolbars: height `h-9`, `text-sm`, `border-border/60`.
- Borders are almost always `/60` opacity so grids read as hairlines.
- A "grid of tiles" is built with `gap-px bg-border/60` on the wrapper and solid backgrounds on the tiles — produces true 1px dividers.

### 2.5 Delta semantics (critical for correctness)

Every metric renders `value` + a signed delta chip. Two directions exist:

| Metric | Up is | Chip color when up |
| --- | --- | --- |
| Leads, Sales, Close rate | good | success |
| Ad spend, CPL, Cost/sale | bad (`invert`) | danger |

Chip anatomy: caret icon (`ArrowUp` / `ArrowDown`, 12px) + formatted delta, in `text-success` or `text-danger`, `text-xs font-medium num`. Neutral (|delta| < 0.5%) renders `text-muted-foreground`.

Formatters:

```ts
formatPct(0.187)      // "18.7%"
formatDelta(-0.124)   // "−12.4%"   (percentage change)
formatDeltaPt(-0.021) // "−2.1pt"   (close-rate point change)
formatCurrency(78000) // "$78,000"  ; compact axis form "$78k"
```

---

## 3. Data contract the UI consumes

The team supplies their own source; the UI only needs these shapes.

```ts
type Region = "West" | "Prairies" | "Ontario" | "Quebec" | "Atlantic";

type Dealership = {
  id: string;
  name: string;
  city: string;
  region: Region;
  brand: string;        // OEM, e.g. "Volkswagen"
  leads: number;   leadsPrev: number;
  sales: number;   salesPrev: number;
  adSpend: number; adSpendPrev: number;
  trend: number[];      // 12 weekly lead points, oldest → newest (sparkline)
};

type DealershipMetrics = Dealership & {
  closeRate: number;  closeRatePrev: number;   // 0..1
  cpl: number;        cplPrev: number;         // adSpend / leads
  cps: number;        cpsPrev: number;         // adSpend / sales
  leadsDelta: number; salesDelta: number;      // pct change
  closeRateDelta: number;                      // absolute point change
  adSpendDelta: number; cplDelta: number;
  priorityScore: number;                       // 0..100
  leadsScore: number; salesScore: number; closeScore: number; cplScore: number;
  reasons: string[];                           // short human bullets
};
```

### 3.1 Priority score (drives ranking, rings, and the explainer)

```ts
const PRIORITY_WEIGHTS = { leads: 0.55, sales: 0.20, close: 0.15, cpl: 0.10 };
```

Algorithm, computed across the currently filtered cohort:
1. For each store take only the *bad* movement: `leadDrop = max(0, -leadsDelta)`, `salesDrop = max(0, -salesDelta)`, `closeDrop = max(0, -closeRateDelta)`, `cplUp = max(0, cplDelta)`.
2. Normalize each to 0–100 against the cohort max for that component.
3. `priorityScore = Σ weight × componentScore`.
4. Build `reasons[]` from thresholds: leads ≤ −5%, sales ≤ −5%, close rate ≤ −1pt, CPL ≥ +10%.

Tiers: `high ≥ 65`, `med ≥ 35`, else `low`. High = danger, med = warning, low = success.

### 3.2 Channel breakout

```ts
type ChannelKey = "google" | "meta" | "bing";

const CHANNEL_META = {
  google: { label: "Google Ads", short: "Google", color: "#1a73e8" },
  meta:   { label: "Meta Ads",   short: "Meta",   color: "#00b4d8" },
  bing:   { label: "Bing Ads",   short: "Bing",   color: "#10b981" },
};
const CHANNEL_ORDER: ChannelKey[] = ["google", "meta", "bing"];

type ChannelMetrics = {
  key: ChannelKey; label: string; color: string;
  spend: number; spendPrev: number; spendDelta: number;
  share: number; sharePrev: number;         // 0..1 of store/network spend
  leads: number; leadsPrev: number; leadsDelta: number;
  sales: number; salesPrev: number; salesDelta: number;
  closeRate: number; closeRatePrev: number;
  cpl: number; cplPrev: number;
  series: { week: string; leads: number; sales: number; spend: number; cpl: number }[]; // 12 pts
};
```

Channel brand hexes are the one sanctioned exception to the no-hardcoded-color rule; keep them in this constants file only.

### 3.3 Snapshots (data-source selector)

```ts
type Snapshot = {
  id: string;
  reportDate: string;   // ISO date
  periodLabel: string;  // "Jul 1 – Jul 28"
  status: "draft" | "published";
  storeCount: number;
};
```

The UI needs a hook returning `{ metrics, snapshots, selected, selectId, source }` where `source` is `"snapshot" | "sample"`. When no published snapshot exists it falls back to embedded sample data and the picker shows a "Sample data" badge.

### 3.4 Name normalization & alias mapping

All name matching (import flow, validation, suggestions) normalizes both sides identically:

```ts
normalize(name) =
  name.toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")  // strip accents
      .replace(/[.,'`"]/g, "")          // strip punctuation
      .replace(/\s+/g, " ")
      .trim()
```

The alias→canonical mapping is keyed by `normalize(alias)`. This app persists it in `localStorage` under `ac.dealership.mapping.v1` (a `{ [normalizedAlias]: canonicalName }` object) and broadcasts an `ac:mapping:changed` window event on every mutation so open views re-validate immediately. Your team can back this with your own store instead — but the normalization rules and the merge/replace import semantics must stay identical, or imported names and hand-entered mappings will disagree.

---

## 4. Application shell

Root layout (`__root.tsx` equivalent):
- `<html lang="en">`, font `<link>`s in head, app stylesheet, favicon.
- Wrap in `QueryClientProvider` (TanStack Query) and render a `<Toaster position="top-right" />` (sonner).
- Provide a 404 view (large `404`, "Page not found", primary "Go home" button) and an error boundary view ("This page didn't load", "Try again" + "Go home").

### 4.1 Header (identical on every page)

```
sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl
  supports-[backdrop-filter]:bg-background/60
  └ mx-auto flex max-w-[1400px] items-center justify-between px-8 py-4
```

Left cluster: AutoCanada logo `h-7 w-auto` → `hidden h-6 w-px bg-border sm:block` divider → route subtitle in `text-xs text-muted-foreground` ("Dealership Priority", "Priority Ranking", "Data Quality", "Import").

Right cluster:
1. **Nav segmented control** — `rounded-xl border border-border/60 bg-surface-muted/70 p-1 text-sm`. Items: Dashboard `/`, Priority `/priority`, Data `/data`, Import `/import`. Active item: `rounded-lg bg-card px-3 py-1.5 font-medium text-brand shadow-soft ring-1 ring-inset ring-brand/15`. Inactive: `rounded-lg px-3 py-1.5 text-muted-foreground hover:text-foreground`.
2. **SnapshotPicker** — select listing snapshots as `{reportDate} · {periodLabel}` with a trailing badge for `draft`; shows "Sample data" pill when `source === "sample"`.
3. **Period select** (`h-9 w-[150px]`): This Month / Last Month / QTD / YTD.
4. **Compare select** (`h-9 w-[210px]`): vs Previous Period / vs Same Period Last Year.

Page body wrapper: `<div className="page-canvas min-h-screen bg-background text-foreground">` with `<main className="mx-auto max-w-[1400px] px-8 py-10">`.

---

## 5. Route: `/` — Executive dashboard

Order of sections top → bottom.

### 5.1 Hero title block
`aurora animate-fade-up -mx-6 mb-8 rounded-3xl px-6 py-5` containing:
- Eyebrow pill: `inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand-soft px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-brand`, with a `animate-pulse-ring h-1.5 w-1.5 rounded-full bg-brand` dot, text "Network priority".
- `<h1 className="font-display text-gradient-brand mt-3 text-[38px] font-semibold leading-tight tracking-tight">Where to focus — {period}</h1>`
- Subline: `{n} dealerships · comparing {compare}` in `text-sm text-muted-foreground`.

### 5.2 KPI strip
`grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 shadow-soft md:grid-cols-3 lg:grid-cols-6`

Six tiles, in order: **Leads · Sales · Close Rate · Ad Spend (invert) · Blended CPL (invert) · Cost / Sale (invert)**.

Tile anatomy: `bg-card px-5 py-4`; label `text-[11px] uppercase tracking-wider text-muted-foreground`; value `mt-1 font-display text-2xl font-semibold num`; delta chip below. Close Rate uses `deltaPt` instead of `delta`.

### 5.3 Ad spend by channel (`ChannelMix`)
Section header "Ad spend by channel" + three cards in `grid gap-4 md:grid-cols-3`. Each card is a **button** (`lift spotlight edge-brand`, `rounded-2xl border bg-card p-5 text-left`) showing:
- channel dot (2.5×2.5 rounded-full, `style={{background: color}}`) + label, plus a chevron on hover.
- Spend `font-display text-2xl num` + delta chip (inverted).
- Secondary row: Leads, CPL, Share — each `label` over `value num`.
- A share bar: full-width `h-1.5 rounded-full bg-muted` with an inner bar at `width: share%` in the channel color.

Clicking opens **ChannelNetworkDrawer** (§8).

### 5.4 Stores needing help
Header row: h2 "Stores needing help" + right-side caption "Ranked by lead decline, weighted by sales, close rate, and CPL".

`grid gap-4 md:grid-cols-2 lg:grid-cols-5` of the top 5 `PriorityCard`s:
- `lift spotlight` card, `rounded-2xl border border-border/60 bg-card p-4`.
- Top row: rank badge (`#1`, `text-[11px] text-muted-foreground num`) and score chip colored by tier.
- `BrandMark` (§7) + store name (`text-sm font-medium leading-tight`, 2-line clamp) + `city · region` muted caption.
- Reason chips (max 2) — `rounded-full bg-danger-soft px-2 py-0.5 text-[10px] text-danger`.
- 12-point sparkline (`ResponsiveContainer` 48px tall, `Line` in brand, no axes, no dots).
- Whole card is clickable → opens **StoreDrilldown** sheet.

### 5.5 All dealerships table
Toolbar (`flex flex-wrap items-center gap-3`): h2 "All dealerships" (`mr-auto`), search input with leading `Search` icon (`h-9 w-[220px] pl-8`), Region select, Brand select (both `h-9 w-[140px]`, first option "All regions"/"All brands").

Table shell: `overflow-hidden rounded-2xl border border-border/60 bg-card shadow-soft`, `<table className="w-full text-sm">`.

Head row: `border-b border-border/60 bg-surface-muted/80 text-[11px] uppercase tracking-wider text-muted-foreground backdrop-blur`. Each `Th` is a click-to-sort button rendering `ArrowUpDown` when inactive and `ArrowUp`/`ArrowDown` when active. First column left-aligned, all numeric columns right-aligned.

Columns: **Dealership · Leads · Sales · Close % · Ad Spend · CPL · Priority**.
- Dealership cell: `BrandMark size="sm"` + name, with `city · brand` muted second line.
- Numeric cells: value `num` with the delta chip underneath in `text-[11px]`.
- Priority cell: small score pill + a 64px `Progress`-style bar tinted by tier.
- Row: `border-b border-border/40 last:border-0 hover:bg-surface-muted/60 cursor-pointer transition-colors`; click opens the drilldown.

Sorting: default `priorityScore` desc. Clicking the active column flips direction; clicking a new column sets it desc.

Empty state: centered `py-16`, muted text "No dealerships match these filters", plus a "Clear filters" ghost button.

---

## 6. Route: `/priority` — Priority leaderboard

- Page h1 `text-[28px] font-semibold tracking-tight`: "Priority ranking", subline explaining the weighting.
- **Weight pills** row: `WeightPill` chips reading `Leads 55% · Sales 20% · Close % 15% · CPL 10%` — `rounded-full border border-border/60 bg-surface-muted px-2.5 py-1 text-[11px]` with the percentage in `font-medium text-foreground`.
- **Tier tiles**: three summary tiles (High / Medium / Low priority) showing counts, each tinted with the matching `*-soft` background and `*-border` border; clicking filters the list.
- Toolbar: search ("Search store"), region select, brand select, status filter (All / Not started / In progress / Addressed).
- **Leaderboard rows** (`PriorityRow`), one per store, `rounded-2xl border border-border/60 bg-card p-4 lift spotlight`:
  - Left: rank numeral (`font-display text-lg num text-muted-foreground`) and `ScoreRing`.
  - `ScoreRing`: 44px SVG donut — background circle `stroke-muted`, progress arc via `strokeDasharray` on `2πr` tinted by tier, score centered in `font-display text-sm font-semibold num`.
  - Middle: `BrandMark` + name, `city · region · brand`, then `ContribBar` set — four thin stacked bars (Leads / Sales / Close / CPL) whose widths are the component sub-scores, colored per component (leads = brand, sales = brand-blue, close = warning, cpl = danger). Hover shows the numeric contribution.
  - Right: `MiniMetric` cluster (Leads, Sales, Close %, CPL) each `label` above `value num`, plus a status badge for the action plan.
  - Bottom: `ChannelStrip` — a single 6px rounded bar segmented by Google/Meta/Bing spend share with a legend of `dot + short label + $spend`.
  - Click opens **StoreDrilldown**.

---

## 7. Shared component: `BrandMark`

Store/OEM logo badge with graceful degradation.

- Sizes: `sm` 24px (`rounded-md`, text 9px), `md` 32px (`rounded-lg`, 10px), `lg` 44px (`rounded-xl`, 12px).
- Attempts a logo image for the dealership's own domain (or its OEM domain) via a logo lookup service; caches `"ok" | "missing"` per domain in `localStorage` for 14 days so repeat renders never flicker or re-request.
- Success state: `inline-flex shrink-0 items-center justify-center overflow-hidden bg-white ring-1 ring-black/5` with `<img class="h-full w-full object-contain p-0.5" loading="lazy" decoding="async">`.
- Fallback: two-letter monogram badge using per-OEM background/foreground colors (Ford `#00274d`/white, Honda `#cc0000`/white, VW `#001e50`/white, BMW `#0166b1`, Kia `#05141f`, Porsche `#0f0f0f`/`#d5001c`, Cadillac `#1b2a41`/`#e3c565`, etc.), `font-display font-semibold tracking-wide`. Unknown brand → first two letters uppercased on `#3f4652`.
- Always set `title` and `aria-label` to the brand name.

---

## 8. Drilldowns

Both use the shadcn `Sheet` (right side), width `sm:max-w-[560px]` (store) / `sm:max-w-[620px]` (channel), `overflow-y-auto`, body padded `p-6`, sections separated by `space-y-6`.

### 8.1 `StoreDrilldown` (store detail)

Header: `BrandMark size="lg"` + `SheetTitle` (store name) + `SheetDescription` (`city · region · brand`), with the score ring and tier badge on the right.

Sections in order:

1. **Why this score** (`ScoreExplainer`) — h3 "Why this score". A horizontal bar chart of the four weighted contributions (value = `weight × componentScore`), each bar in its component color, labeled with the metric name, its raw movement (e.g. "Leads ▼ 12%") and its point contribution. Below it a plain-language sentence summarizing the top two drivers. Bars for components contributing 0 render as faint tracks.
2. **Period comparison** (`Comparison`) — h3 "Current vs previous". A 4-column grid: Leads, Sales, Close %, Ad spend. Each shows current (`font-display text-xl num`), previous in muted, and a delta chip with correct inversion. A secondary row adds CPL and Cost/sale.
3. **Trends** (`Charts`) — h3 "Trends". 2×2 grid of `ChartCard`s: **Leads**, **Sales**, **Close %**, **Ad spend**. Each card: title + current value + delta chip in the header, then a 120px `ResponsiveContainer` with an `AreaChart`/`LineChart`: `CartesianGrid strokeDasharray="3 3"` at low opacity, `XAxis` hidden ticks, `YAxis` width 40 with a compact formatter (`$78k`, `18%`), `Tooltip` with a card-styled content wrapper. Series is 12 points interpolated from previous → current with deterministic jitter, so shapes stay stable across renders.
4. **Ad spend by channel** (`ChannelBreakdown`) — h3 "Ad spend by channel". Three `ChannelCard`s stacked: dot + label + share %, spend with delta, a `MiniChart` (48px sparkline in the channel color), and a `Stat` row of Leads / Sales / CPL / Close % with deltas. Expanding a card reveals the 12-week leads-vs-spend chart.
5. **Action plan** (`PlanEditor`) — h3 "Action plan".
   - Status segmented control: **Not started / In progress / Addressed** (Addressed = success tint).
   - Owner input (`placeholder="Owner"`), and a due-date input.
   - Next steps: a checklist; each row is a checkbox + text; an input with `placeholder="Add a next step…"` appends on Enter.
   - Notes `Textarea` with `placeholder="What did you find? What did you change?"`, auto-saving on blur with a sonner toast confirmation ("Plan saved").
   - Footer shows `Last updated {relative time} by {owner}`.

### 8.2 `ChannelNetworkDrawer` (network channel detail)

Header: channel dot + `SheetTitle` = channel label, description = "Network-wide · {period}".

1. **Stat grid** — Spend, Leads, Sales, CPL, Close %, Share of spend; each `Stat` = label, `font-display text-xl num` value, delta chip (spend/CPL inverted).
2. **Leads vs sales** — `AreaChart`, two series (leads = channel color, sales = brand-blue), 12 weekly points, gradient fills at 20% → 0 opacity.
3. **Spend vs CPL** — dual-axis `LineChart`; left axis currency (`$78k` formatter), right axis CPL (`$120`). Compact tick formatters are required or axis labels overlap.
4. **Stores dragging this channel** — ranked list of up to 15 rows: `BrandMark size="sm"` + name, channel spend, channel CPL delta, and a small risk score. Row click closes this drawer and opens that store's `StoreDrilldown`.

---

## 9. Route: `/data` — Data quality

Page h1 "Data quality", subline about reconciling source names to the canonical roster.

Summary tiles row (`SummaryTile`): Roster stores · Mapped aliases · Unmatched · Duplicates — value `font-display text-2xl num`, label muted, tinted by severity.

`Tabs` with three triggers: **Validation · Coverage · Mapping editor**.

### Validation
- Search input ("Search name") + kind filter.
- Rows (`IssueRow`) inside a bordered card list. Each row: `IssueBadge` (kind = `missing` amber / `duplicate` blue / `unmatched` red, `rounded-full ... text-[10px] uppercase`), the offending source name in `font-mono text-xs`, the dataset it came from, and on the right a `Select` (`placeholder="Map to dealership…"`) plus up to 5 **suggestion chips** — closest canonical matches from fuzzy matching, each chip showing name + confidence %. Clicking a chip applies the mapping and toasts.
- Empty state: "No issues found — all source names resolve."

#### Fuzzy matching (drives the suggestion chips)

Similarity is a **Dice coefficient over character bigrams** of the normalized names (see §3.4 for normalization):

```ts
// bigrams("maple ridge vw") -> ["ma","ap","pl",...]
score = (2 * |bigrams(a) ∩ bigrams(b)|) / (|bigrams(a)| + |bigrams(b)|)
```

- Candidates: score every unmatched alias against the canonical roster, sort desc, keep the top 5.
- The confidence % shown on a chip is `round(score * 100)`.
- Exact normalized equality short-circuits to 100%. Very short aliases (< 4 chars after normalization) require a higher minimum score to avoid false positives.
- The same algorithm powers the review-grid "Match candidates" in §10.

### Coverage
- Search ("Search dealership") + filter toggles (All / Mapped / Unmatched / Verified metrics / Placeholder).
- Grid of `CoverageCard`s: `BrandMark` + name, region/brand caption, and two status pills — mapping status and metric provenance ("Verified" vs "Placeholder").

### Mapping editor
- **Add mapping** card: alias input (`placeholder='e.g. "Maple Ridge VW"'`) + canonical `Select` (`placeholder="Choose dealership…"`) + Add button.
- **Current mappings** table: alias (`font-mono text-xs`) → canonical, with inline edit and delete.
- **Import / export** panel: `Textarea` accepting JSON or CSV (`placeholder='{ "Maple Ridge VW": "Maple Ridge Volkswagen" }'`), radio for **Merge** vs **Replace**, a validation preview listing accepted/rejected lines, and Export buttons for JSON and CSV.
- All mutations toast success/failure and re-run validation immediately.

---

## 10. Route: `/import` — Screenshot import

Page h1 "Import screenshot data", subline about the manual bridge until the BI feed is connected.

1. **Dropzone** — large dashed card (`rounded-2xl border-2 border-dashed border-border/60 bg-surface-muted/40 p-10 text-center`), accepts multiple images, drag-over state switches border to `border-brand` and background to `bg-brand-soft`. Shows thumbnails of queued files with remove buttons.
2. **Parse queue** — one row per file with a progress state: Queued → Parsing (shimmer bar) → Parsed / Failed. Failed rows expose a Retry button and the error text.
3. **Draft snapshots** — parsed files group into drafts by detected report date. Each draft card has:
   - Header: detected date (editable date input), period label input (`placeholder="e.g. Jul 1 – Jul 28"`), row count, and store coverage.
   - **Review grid**: editable table of parsed rows — source name, mapped dealership `Select` (`placeholder="Map to dealership"`), Leads / Leads prev / Sales / Sales prev / Ad spend / Ad spend prev as inline number inputs, and a **ConfidenceBadge**.
   - `ConfidenceBadge`: `≥85%` success, `70–84%` warning, `<70%` danger; renders `{value}%` plus a warning icon with a tooltip listing parse warnings. Low-confidence rows also get a `bg-warning-soft/40` row tint.
   - **Match candidates**: for low-confidence name matches, up to 5 clickable chips of alternative roster stores (`placeholder="Pick another store"` select as fallback).
   - **Auto-merge duplicates** button: consolidates duplicate dealership rows within the draft, keeping the highest-confidence value per metric; shows a summary toast of what merged.
   - Notes `Textarea` (`placeholder="Anything worth remembering about this import…"`).
   - Footer actions: Discard draft · Save as draft · **Publish** (primary). A "Publish all" button sits above the draft list when more than one draft is ready.
4. **Snapshot history** — h2 "Snapshot history": table of published/draft snapshots with date, period label, row count, stores covered, unmatched count, status badge, and row actions (view original image, re-parse, unpublish, delete). Destructive actions confirm via `AlertDialog`.

---

## 11. States & accessibility

- **Loading**: skeleton blocks (`Skeleton`, `rounded-xl`) matching final layout; charts render an empty axis frame rather than collapsing. Never use spinners for full sections.
- **Empty**: centered `py-16` block — one-line explanation + one primary action. No illustrations, no emojis.
- **Error**: inline `border-danger-border bg-danger-soft text-danger` card with the message and a Retry button.
- **Toasts**: sonner, top-right, for every save/import/publish/mapping mutation.
- Interactive cards must be real `<button>` elements with `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`.
- Sheets trap focus and close on Escape; drawer titles are the accessible name.
- Every chart is accompanied by the same numbers in text (KPI value + delta) so it isn't the only carrier of meaning.
- Color is never the sole delta signal — always pair with the caret icon and a sign.
- Target contrast AA in both themes; `muted-foreground` is the lightest text permitted on `card`/`surface`.

## 12. Responsive behaviour

| Breakpoint | Behaviour |
| --- | --- |
| `<768px` | KPI grid 2-up; priority cards 1-up; header nav collapses to an icon menu; table becomes a stacked card list (Dealership + Priority + two key metrics); sheets go full-width |
| `768–1024px` | KPI 3-up; priority cards 2-up; channel cards stack to 1-up under 900px; table keeps Dealership, Leads, Sales, Priority |
| `≥1024px` | KPI 6-up; priority cards 5-up; channel cards 3-up; full table |
| `≥1400px` | Container caps at 1400px and centers |

## 13. Build order

1. Tokens + utilities in `styles.css`, fonts, shell/header/nav.
2. Formatters, `DealershipMetrics` derivation, and the priority score.
3. Dashboard: KPI strip → table → priority cards.
4. `BrandMark` and the logo cache.
5. `StoreDrilldown` (explainer → comparison → charts → action plan).
6. `/priority` leaderboard with rings and contribution bars.
7. Channel layer: constants, `ChannelBreakdown`, `ChannelMix`, `ChannelNetworkDrawer`.
8. `/data` validation, coverage, mapping editor.
9. `/import` dropzone, review grid, confidence badges, history.

## 14. Non-negotiables checklist

- [ ] No emojis in any UI copy.
- [ ] No hardcoded color classes outside the channel/OEM constants files.
- [ ] All colors defined as oklch tokens with light and dark values.
- [ ] Sora headings, Manrope body, JetBrains Mono for raw values.
- [ ] Every numeric column uses the `num` (tabular) utility.
- [ ] Ad spend / CPL / cost-per-sale deltas are inverted (up = red).
- [ ] Priority weights are 55 / 20 / 15 / 10 and shown in the UI.
- [ ] `prefers-reduced-motion` disables aurora, shimmer, pulse and lift transitions.
- [ ] Each route has its own unique title and meta description.
- [ ] Logo.dev token provided (`VITE_LOVABLE_CONNECTOR_LOGO_DEV_API_KEY`); without it BrandMark renders monograms only (acceptable fallback).
