import { Link } from "@tanstack/react-router";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Snapshot } from "@/lib/snapshots";
import { cn } from "@/lib/utils";

const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export function SnapshotPicker({
  snapshots,
  selected,
  onSelect,
  source,
  className,
}: {
  snapshots: Snapshot[];
  selected: Snapshot | null;
  onSelect: (id: string | null) => void;
  source: "snapshot" | "embedded";
  className?: string;
}) {
  if (snapshots.length === 0) {
    return (
      <Link
        to="/import"
        className={cn(
          "rounded-md border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground",
          className,
        )}
      >
        Sample data — import a screenshot
      </Link>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-[11px] font-medium",
          source === "snapshot"
            ? "bg-emerald-500/10 text-emerald-600"
            : "bg-muted text-muted-foreground",
        )}
      >
        {source === "snapshot" ? "Imported data" : "Sample data"}
      </span>
      <Select
        value={selected?.id ?? ""}
        onValueChange={(v) => onSelect(v || null)}
      >
        <SelectTrigger className="h-9 w-[230px] border-border/60 bg-background text-sm">
          <SelectValue placeholder="Select a data snapshot" />
        </SelectTrigger>
        <SelectContent>
          {snapshots.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {fmtDate(s.reportDate)}
              {s.periodLabel ? ` · ${s.periodLabel}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
