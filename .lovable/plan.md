## Screenshot → data import (bridge until Tableau connects)

Goal: drop a Tableau screenshot for a given day, have it parsed into structured store metrics, review/correct it, save it as a dated snapshot in the backend, and have the dashboard read from those snapshots with date-range and period-comparison filtering.

### 1. Storage
- New private storage bucket `tableau-screenshots` for the raw images (audit trail, re-parse later).
- New tables:
  - `snapshots` — one row per import: report date, period label (e.g. "Jul 1–28"), source view (Store / Lead Source / Inventory Type), image path, status (`draft` / `published`), notes.
  - `snapshot_metrics` — one row per store per snapshot: dealership id (canonical), raw source name, leads, leads_prev, sales, sales_prev, ad_spend, ad_spend_prev, close_rate columns as derived.
- Grants + RLS matching the current open-workspace model used by action plans (no login yet).

### 2. Import flow (`/import`)
1. **Upload** — drag one or more screenshots, pick the report date and period label.
2. **Parse** — the image goes to the AI vision model (Lovable AI, no key needed) with a strict schema prompt: return rows of `{ name, current, previous, diff }` per table detected, plus which metric each table represents (Leads / Sales / Close Rate / Ad Spend).
3. **Reconcile** — parsed names run through the existing `mapping.ts` fuzzy matcher, so aliases like "Northland VW" resolve to the canonical roster. Unmatched names surface with the same suggestion chips already built on the Data page, mappable inline.
4. **Review grid** — editable table of every parsed row with the source image side-by-side; confidence flags on cells the model was unsure about, plus arithmetic checks (does diff % match current vs previous?). Nothing is trusted blindly — you approve before it saves.
5. **Publish** — writes the snapshot + metrics rows; the raw image stays in storage.

### 3. Dashboard wiring
- A global date/period control in the shared header: pick a snapshot as "current" and another as "compare to" (defaults: latest vs previous snapshot).
- `dealerships.ts` changes from a hardcoded dataset to a resolver: if published snapshots exist, metrics come from the database; otherwise it falls back to today's embedded roster data so nothing goes blank.
- The roster (69 stores, region/brand) stays code-side as the canonical list; snapshots only supply the numbers.
- Priority scoring, Coverage, Validation, and the drilldown charts all read from the selected snapshot pair — no formula changes.
- Trend charts stop being simulated once 3+ snapshots exist: real point-per-snapshot lines, with the simulated sparkline used only when there's insufficient history.

### 4. Snapshot management
- `/import` gets a history list: every snapshot with date, row count, stores covered, unmatched count, and actions to view the original screenshot, re-parse, edit, unpublish, or delete.

### 5. Tableau handoff later
Because everything lands in `snapshot_metrics`, swapping to a real Tableau/CSV feed later means writing to the same table — the dashboard, scoring and history stay untouched.

### Technical notes
- Parsing runs in a `createServerFn` calling the AI gateway with a Gemini vision model; image passed as a base64 data URL or signed storage URL.
- Multi-metric screenshots (the 3-table layouts you shared) are handled in one pass — the model returns each table separately, tagged by metric.
- Idempotency: re-importing the same date + view replaces that snapshot's metric rows rather than duplicating.
- Deltas (`prev` columns) come straight from the screenshot's "previous" column, so period-over-period comparison works from the very first import.

### Rollout order
1. Tables + bucket
2. Upload & parse server function
3. Review/edit grid + publish
4. Snapshot history
5. Dashboard date-range switch + fallback to embedded data
