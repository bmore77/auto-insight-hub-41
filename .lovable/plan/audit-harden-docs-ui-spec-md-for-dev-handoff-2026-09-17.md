# Audit & harden docs/UI-SPEC.md for dev handoff

## Goal

Verify the UI recreation spec is complete and self-contained so the dev team can rebuild the interface against their own data, and patch the few gaps found.

## Audit result

Reviewed all 652 lines of `docs/UI-SPEC.md` against the actual codebase (`src/styles.css`, `src/routes/*`, `src/lib/*`, components). The spec is already strong: design tokens, utilities, keyframes, per-route anatomy, data contracts, priority-score algorithm, states, responsive rules, and build order all match the code.

Gaps found — three details the dev team would otherwise have to reverse-engineer:

1. **Logo lookup service contract** — §7 says "a logo lookup service" but the implementation is specifically Logo.dev's image CDN with a publishable token: `https://img.logo.dev/{domain}?token={VITE_LOVABLE_CONNECTOR_LOGO_DEV_API_KEY}&size={2x}&format=png&retina=true`, fed by a per-OEM domain map and a per-store domain override map. Without this note, logos silently fall back to monograms in their environment.
2. **Fuzzy-match algorithm** — §9 mentions fuzzy matching for suggestion chips but doesn't name it. The implementation is a Dice-coefficient bigram similarity over normalized names, returning the top 5 candidates above a minimum score.
3. **Name normalization rules + mapping persistence contract** — the alias mapping key is the normalized name (lowercase, NFKD accent strip, punctuation removed, whitespace collapsed), stored under the localStorage key `ac.dealership.mapping.v1`. The team replacing localStorage with their backend still needs the normalization rules so imported names and user mappings resolve identically.

## Changes

Edit `docs/UI-SPEC.md` only:

1. **§7 BrandMark** — replace the "logo lookup service" sentence with the concrete Logo.dev URL pattern, the env-var name for the token, and a note that the OEM/store domain maps are data the team must supply (their own store domains win over the OEM fallback). Keep the cache/fallback behavior as written.
2. **§9 Validation** — add a short "Fuzzy matching" subsection: Dice-coefficient bigram similarity, normalized inputs, top-5 candidates, minimum threshold, and that confidence % shown on chips is the similarity score × 100.
3. **§3 Data contract** — add a "Name normalization & mapping persistence" note: the exact normalization steps, the localStorage key used in this app, and that their backend equivalent must normalize identically so imports and manual mappings agree.
4. Add a one-line pointer in §14 checklist: "Logo token provided; without it BrandMark renders monograms only (acceptable fallback)."

No code changes. No other files touched.
