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
