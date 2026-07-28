/**
 * Per-dealership action plans (next steps, notes, addressed tracking).
 * Persisted in the Lovable Cloud database so the workflow is shared across devices.
 */
import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

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

type PlanRow = {
  dealership_id: string;
  status: string;
  owner: string;
  steps: unknown;
  notes: unknown;
  score_when_ranked: number | null;
  created_at: string;
  updated_at: string;
};

function rowToPlan(row: PlanRow): ActionPlan {
  return {
    dealershipId: row.dealership_id,
    status: (row.status as PlanStatus) ?? "not_started",
    owner: row.owner ?? "",
    steps: Array.isArray(row.steps) ? (row.steps as ActionStep[]) : [],
    notes: Array.isArray(row.notes) ? (row.notes as ActionNote[]) : [],
    scoreWhenRanked: row.score_when_ranked,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function planToRow(plan: ActionPlan) {
  return {
    dealership_id: plan.dealershipId,
    status: plan.status,
    owner: plan.owner,
    steps: plan.steps as unknown as never,
    notes: plan.notes as unknown as never,
    score_when_ranked: plan.scoreWhenRanked,
  };
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

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.from("action_plans").select("*");
    if (error) {
      console.error("Failed to load action plans", error);
      return;
    }
    const next: PlanMap = {};
    for (const row of (data ?? []) as PlanRow[]) next[row.dealership_id] = rowToPlan(row);
    setPlans(next);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Keep every open device in sync.
  useEffect(() => {
    const channel = supabase
      .channel("action_plans_sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "action_plans" }, () => {
        void refresh();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  const update = useCallback(
    (dealershipId: string, score: number | null, fn: (p: ActionPlan) => ActionPlan) => {
      setPlans((prev) => {
        const base = prev[dealershipId] ?? emptyPlan(dealershipId, score);
        const updated: ActionPlan = { ...fn(base), updatedAt: new Date().toISOString() };
        void supabase
          .from("action_plans")
          .upsert(planToRow(updated), { onConflict: "dealership_id" })
          .then(({ error }) => {
            if (error) console.error("Failed to save action plan", error);
          });
        return { ...prev, [dealershipId]: updated };
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
      return next;
    });
    void supabase
      .from("action_plans")
      .delete()
      .eq("dealership_id", id)
      .then(({ error }) => {
        if (error) console.error("Failed to reset action plan", error);
      });
  }, []);

  return {
    plans,
    refresh,
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
