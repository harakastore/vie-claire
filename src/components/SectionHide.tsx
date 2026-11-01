import { useCallback, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const HIDDEN_KEY = "vie-claire:hidden-sections";
const LEGACY_WEEKLY_KEY = "vie-claire:weekly-goals-hidden";

/** Sections the user chose to hide on this device (never stored in the database). */
function readHidden(): string[] {
  try {
    const raw = localStorage.getItem(HIDDEN_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const ids = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
    if (localStorage.getItem(LEGACY_WEEKLY_KEY) === "1" && !ids.includes("weekly")) ids.push("weekly");
    return ids;
  } catch {
    return [];
  }
}

function writeHidden(ids: string[]) {
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(ids));
    localStorage.removeItem(LEGACY_WEEKLY_KEY);
  } catch {
    /* stockage indisponible */
  }
}

export function useHiddenSections() {
  const [hidden, setHidden] = useState<string[]>(() => readHidden());

  const isHidden = useCallback((id: string) => hidden.includes(id), [hidden]);

  const toggle = useCallback((id: string) => {
    setHidden((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      writeHidden(next);
      return next;
    });
  }, []);

  const showAll = useCallback(() => {
    setHidden([]);
    writeHidden([]);
  }, []);

  return { hidden, hiddenCount: hidden.length, isHidden, toggle, showAll };
}

/** Small icon button that hides a section. */
export function HideButton({ label, onClick, compact, className }: {
  label: string; onClick: () => void; compact?: boolean; className?: string;
}) {
  return (
    <Button
      size="sm"
      variant="outline"
      className={cn("shrink-0", compact ? "h-6 w-6 p-0" : "h-7 px-2", className)}
      aria-label={`Masquer ${label}`}
      title={`Masquer ${label}`}
      onClick={onClick}
    >
      <EyeOff className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
    </Button>
  );
}

/** Dashed bar shown in place of a hidden section; clicking it brings the section back. */
export function HiddenBar({ label, onClick, compact, className }: {
  label: string; onClick: () => void; compact?: boolean; className?: string;
}) {
  return (
    <Button
      variant="outline"
      className={cn("w-full justify-start gap-2 rounded-xl border-dashed", compact ? "h-9 px-3" : "h-11 px-4", className)}
      onClick={onClick}
    >
      <Eye className={cn("shrink-0", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
      <span className={cn("vc-hidden-label min-w-0 truncate", compact ? "text-xs" : "text-sm")}>{label}</span>
      <span className={cn("text-xs font-medium text-muted-foreground", compact ? "shrink-0" : "whitespace-nowrap")}>
        {compact ? "masqué" : "masqué — cliquer pour afficher"}
      </span>
    </Button>
  );
}
