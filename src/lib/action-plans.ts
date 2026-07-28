/**
 * Per-dealership action plans (next steps, notes, addressed tracking).
 * Persisted in localStorage so VPs can track follow-up without a backend.
 */
import { useCallback, useEffect, useState } from "react";

const KEY = "ac.actionPlans.v1";

export type PlanStatus = "not_started" | "in_progress" | "addressed";

export type ActionStep = {
  id: string;
  text: string;
  done: boolean;
  owner?: string;
  due?: string;
};

export type ActionNote = {
  id: string;
  text: string;
  at: string;
};

export type ActionPlan = {
  dealershipId: string;
  status: PlanStatus;
  owner: string;
  steps: ActionStep[];
  notes: ActionNote[];
  /** Priority score at the time the plan was created / last reset. */
  scoreWhenRanked: number | null;
  createdAt: string;
  updatedAt: string;
};

export type PlanMap = Record<string, ActionPlan>;

export const STATUS_LABEL: Record<PlanStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  addressed: "Addressed",
};

const uid = () => Math.random().toString(36).slice(2, 10);

export function emptyPlan(dealershipId: string, score: number | null): ActionPlan {
  const now = new Date().toISOString();
  return {
    dealershipId,
    status: "not_started",
    owner: "",
    steps: [],
    notes: [],
    scoreWhenRanked: score,
    createdAt: now,
    updatedAt: now,
  };
}

export function loadPlans(): PlanMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PlanMap) : {};
  } catch {
    return {};
  }
}

function savePlans(plans: PlanMap) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(plans));
  } catch {
    /* quota / private mode — ignore */
  }
}

/** Suggested next steps derived from why a store was flagged. */
export function suggestedSteps(reasons: string[]): string[] {
  const out: string[] = [];
  for (const r of reasons) {
    if (r.startsWith("Leads")) out.push("Audit lead sources and reallocate spend to top converters");
    if (r.startsWith("Sales")) out.push("Review sales floor staffing and inventory mix");
    if (r.startsWith("Close")) out.push("Run BDC call-quality and speed-to-lead review");
    if (r.startsWith("CPL")) out.push("Rebuild underperforming campaigns to bring CPL down");
  }
  if (out.length === 0) out.push("Confirm store is stable — no intervention needed");
  return Array.from(new Set(out));
}

export function useActionPlans() {
  const [plans, setPlans] = useState<PlanMap>({});

  useEffect(() => {
    setPlans(loadPlans());
  }, []);

  const update = useCallback(
    (dealershipId: string, score: number | null, fn: (p: ActionPlan) => ActionPlan) => {
      setPlans((prev) => {
        const base = prev[dealershipId] ?? emptyPlan(dealershipId, score);
        const next: PlanMap = {
          ...prev,
          [dealershipId]: { ...fn(base), updatedAt: new Date().toISOString() },
        };
        savePlans(next);
        return next;
      });
    },
    [],
  );

  const setStatus = useCallback(
    (id: string, score: number | null, status: PlanStatus) =>
      update(id, score, (p) => ({ ...p, status })),
    [update],
  );

  const setOwner = useCallback(
    (id: string, score: number | null, owner: string) =>
      update(id, score, (p) => ({ ...p, owner })),
    [update],
  );

  const addStep = useCallback(
    (id: string, score: number | null, text: string) =>
      update(id, score, (p) => ({
        ...p,
        steps: [...p.steps, { id: uid(), text, done: false }],
        status: p.status === "not_started" ? "in_progress" : p.status,
      })),
    [update],
  );

  const toggleStep = useCallback(
    (id: string, score: number | null, stepId: string) =>
      update(id, score, (p) => ({
        ...p,
        steps: p.steps.map((s) => (s.id === stepId ? { ...s, done: !s.done } : s)),
      })),
    [update],
  );

  const removeStep = useCallback(
    (id: string, score: number | null, stepId: string) =>
      update(id, score, (p) => ({ ...p, steps: p.steps.filter((s) => s.id !== stepId) })),
    [update],
  );

  const addNote = useCallback(
    (id: string, score: number | null, text: string) =>
      update(id, score, (p) => ({
        ...p,
        notes: [{ id: uid(), text, at: new Date().toISOString() }, ...p.notes],
      })),
    [update],
  );

  const removeNote = useCallback(
    (id: string, score: number | null, noteId: string) =>
      update(id, score, (p) => ({ ...p, notes: p.notes.filter((n) => n.id !== noteId) })),
    [update],
  );

  const resetPlan = useCallback((id: string) => {
    setPlans((prev) => {
      const next = { ...prev };
      delete next[id];
      savePlans(next);
      return next;
    });
  }, []);

  return {
    plans,
    setStatus,
    setOwner,
    addStep,
    toggleStep,
    removeStep,
    addNote,
    removeNote,
    resetPlan,
  };
}
