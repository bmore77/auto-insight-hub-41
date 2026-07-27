# Auto Canada — Dealership Priority Dashboard

A clean, Notion/Apple-inspired reporting dashboard that surfaces which stores need the most help, ranked primarily by lead declines vs prior period, with sales, close rate, and ad spend context.

## Landing view (Hybrid)

Top: **Priority Action Hero**
- Network KPI strip: Total Leads, Total Sales, Network Close %, Total Ad Spend, blended CPL / CPS — each with delta vs prior period (green/red, subtle).
- Period selector (This Month / Last Month / QTD / YTD / Custom) + Compare-to (Previous Period / Same Period Last Year).
- "Stores Needing Help" — top 5 dealership cards ranked by composite priority score. Each card shows: rank, dealership name, priority reason chips ("Leads ▼ 28%", "Close % ▼ 4pt", "CPL ▲ 42%"), sparkline of leads trend, and a "View store" affordance.

Bottom: **Full Dealership Table**
- Sortable, filterable rows for every dealership.
- Columns: Dealership · Leads (Δ%) · Sales (Δ%) · Close % (Δ pt) · Ad Spend (Δ%) · CPL · CPS · Priority Score.
- Column filters: Region, Brand, Store type. Search box. Column sort. Row click opens a store detail drawer.

## Store detail drawer
- Header: dealership, region, brand.
- KPI tiles with period-over-period deltas.
- Charts: Leads vs Sales (dual-axis line), Close % trend, Ad Spend vs CPL trend.
- Why it's flagged: bulleted diagnostic based on which sub-scores triggered priority.

## Priority scoring (v1)
Primary weight on leads decline, with supporting signals so a store that's bleeding leads AND wasting ad spend ranks above one with only a soft lead dip.

```text
priority = 0.55 * leadsDropScore
         + 0.20 * salesDropScore
         + 0.15 * closeRateDropScore
         + 0.10 * adSpendEfficiencyScore   // penalizes rising CPL/CPS
```
Each sub-score normalized 0–100 across the network for the selected period.

## Design system (Notion / Apple)
- Neutral canvas: near-white background, soft dividers, generous whitespace.
- Typography: one geometric sans (e.g., Inter/SF-like) — large numbers, small uppercase labels, restrained weights.
- Color: monochrome UI with two accents only — subtle green for positive delta, muted red for negative. No gradients, no heavy shadows.
- Cards: 1px hairline borders, 12–16px radius, quiet hover states.
- Motion: minimal — 150ms ease for hover/expand.
- Charts: thin strokes, no gridlines beyond a baseline, tooltips on hover.

## Data
Since the Tableau export isn't attached yet, v1 ships with **realistic mock data** shaped like the real feed so the UI, ranking, and interactions are fully working. Swapping to real data means replacing one typed dataset file.

Expected schema per dealership per period:
```text
dealership_id, name, region, brand,
leads, leads_prev,
sales, sales_prev,
ad_spend, ad_spend_prev,
close_rate = sales/leads,
cpl = ad_spend/leads,
cps = ad_spend/sales
```

## Technical notes
- TanStack Start route `/` becomes the dashboard (replaces placeholder index).
- Store detail is a modal drawer on the same route (no separate page needed for v1).
- Mock data + scoring live in `src/lib/dealerships.ts` with typed periods so the CSV import later is a drop-in.
- Charts via Recharts (line + sparkline). Tables built with shadcn/ui + TanStack Table for sort/filter.
- All colors/spacing via semantic tokens in `src/styles.css` — no hardcoded hex in components.

## Out of scope for v1
- Auth / multi-user (add later with Lovable Cloud if needed).
- Writing back to Tableau.
- Automated CSV upload UI (v2 — for now data is a typed module).

## Next step after approval
Build v1 with mock data matching the schema above. When you share the Tableau dashboard screenshot or a CSV export, I'll map fields exactly and swap the mock module for the real dataset.
