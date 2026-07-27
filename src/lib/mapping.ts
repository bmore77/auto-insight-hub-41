import { useEffect, useState } from "react";

// Alias -> canonical dealership name. Persisted in localStorage so users
// can correct naming without editing code. Normalized keys for matching.

const STORAGE_KEY = "ac.dealership.mapping.v1";
const EVENT = "ac:mapping:changed";

export type MappingEntry = { alias: string; canonical: string };

export const normalizeName = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[.,'`"]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const read = (): Record<string, string> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
};

const write = (m: Record<string, string>) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
  window.dispatchEvent(new Event(EVENT));
};

export const getMapping = read;

export const setAlias = (alias: string, canonical: string) => {
  const key = normalizeName(alias);
  if (!key || !canonical.trim()) return;
  const m = read();
  m[key] = canonical.trim();
  write(m);
};

export const removeAlias = (alias: string) => {
  const key = normalizeName(alias);
  const m = read();
  delete m[key];
  write(m);
};

export const clearMapping = () => write({});

/** Bulk apply a mapping object. `mode` = "merge" keeps existing, "replace" wipes first. */
export const importMapping = (
  incoming: Record<string, string>,
  mode: "merge" | "replace" = "merge",
) => {
  const base = mode === "replace" ? {} : read();
  for (const [alias, canonical] of Object.entries(incoming)) {
    const key = normalizeName(alias);
    if (!key || !canonical || !canonical.trim()) continue;
    base[key] = canonical.trim();
  }
  write(base);
};

/* ---------- Fuzzy matching (Dice coefficient on bigrams) ---------- */

const bigrams = (s: string): Map<string, number> => {
  const n = normalizeName(s).replace(/\s+/g, "");
  const m = new Map<string, number>();
  for (let i = 0; i < n.length - 1; i++) {
    const bg = n.slice(i, i + 2);
    m.set(bg, (m.get(bg) ?? 0) + 1);
  }
  return m;
};

export const similarity = (a: string, b: string): number => {
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const [bg, ca] of A) {
    const cb = B.get(bg);
    if (cb) inter += Math.min(ca, cb);
  }
  const total = Array.from(A.values()).reduce((s, v) => s + v, 0) +
    Array.from(B.values()).reduce((s, v) => s + v, 0);
  return (2 * inter) / total;
};

export type FuzzyMatch = { name: string; score: number };

export const fuzzySuggest = (
  raw: string,
  candidates: string[],
  limit = 3,
): FuzzyMatch[] =>
  candidates
    .map((name) => ({ name, score: similarity(raw, name) }))
    .filter((m) => m.score > 0.25)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

/* ---------- Import validation ---------- */

export type ImportValidation = {
  ok: boolean;
  entries: Array<{ alias: string; canonical: string }>;
  errors: string[];
  warnings: string[];
};

/**
 * Accepts either:
 *  - JSON object: { "alias": "Canonical", ... }
 *  - JSON array: [{ alias, canonical }, ...]
 *  - CSV (2 cols): alias,canonical
 */
export const parseMappingFile = (
  text: string,
  canonicalNames: string[],
): ImportValidation => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const entries: Array<{ alias: string; canonical: string }> = [];
  const canonicalSet = new Set(canonicalNames.map(normalizeName));

  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, entries, errors: ["File is empty."], warnings };
  }

  let raw: Array<[string, string]> = [];
  const looksJson = trimmed.startsWith("{") || trimmed.startsWith("[");

  if (looksJson) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        for (const [i, r] of parsed.entries()) {
          if (!r || typeof r !== "object") {
            errors.push(`Row ${i + 1}: not an object.`);
            continue;
          }
          const a = (r as any).alias ?? (r as any).from;
          const c = (r as any).canonical ?? (r as any).to;
          if (typeof a !== "string" || typeof c !== "string") {
            errors.push(`Row ${i + 1}: needs "alias" and "canonical" strings.`);
            continue;
          }
          raw.push([a, c]);
        }
      } else if (parsed && typeof parsed === "object") {
        for (const [a, c] of Object.entries(parsed)) {
          if (typeof c !== "string") {
            errors.push(`"${a}": value must be a string.`);
            continue;
          }
          raw.push([a, c]);
        }
      } else {
        errors.push("JSON root must be an object or array.");
      }
    } catch (e) {
      errors.push(`Invalid JSON: ${(e as Error).message}`);
    }
  } else {
    // CSV
    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim());
    const first = lines[0]?.toLowerCase() ?? "";
    const startIdx =
      first.includes("alias") && first.includes("canonical") ? 1 : 0;
    for (let i = startIdx; i < lines.length; i++) {
      const parts = lines[i].split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
      if (parts.length < 2 || !parts[0] || !parts[1]) {
        errors.push(`Line ${i + 1}: expected "alias,canonical".`);
        continue;
      }
      raw.push([parts[0], parts[1]]);
    }
  }

  const seen = new Set<string>();
  for (const [alias, canonical] of raw) {
    const key = normalizeName(alias);
    if (!key) {
      errors.push(`Empty alias for "${canonical}".`);
      continue;
    }
    if (seen.has(key)) {
      warnings.push(`Duplicate alias "${alias}" — last one wins.`);
    }
    seen.add(key);
    if (!canonicalSet.has(normalizeName(canonical))) {
      warnings.push(`"${canonical}" is not in the current dealership list.`);
    }
    entries.push({ alias, canonical });
  }

  return { ok: errors.length === 0 && entries.length > 0, entries, errors, warnings };
};

/** Resolve a raw source name to its canonical form (or the original). */
export const resolveName = (
  raw: string,
  mapping: Record<string, string> = read(),
): string => {
  const key = normalizeName(raw);
  return mapping[key] ?? raw;
};

/** React hook — subscribes to mapping changes across the app. */
export function useMapping(): [
  Record<string, string>,
  {
    set: (alias: string, canonical: string) => void;
    remove: (alias: string) => void;
    clear: () => void;
  },
] {
  const [state, setState] = useState<Record<string, string>>(() => read());
  useEffect(() => {
    const sync = () => setState(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return [
    state,
    { set: setAlias, remove: removeAlias, clear: clearMapping },
  ];
}
