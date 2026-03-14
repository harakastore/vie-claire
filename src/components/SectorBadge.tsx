import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function SectorBadge({ sector }: { sector: string }) {
  const isPerso = sector === "perso";
  return (
    <Badge variant="outline" className={cn(
      "text-xs font-medium",
      isPerso
        ? "bg-[hsl(var(--sector-perso)/0.1)] text-[hsl(var(--sector-perso))] border-[hsl(var(--sector-perso)/0.3)]"
        : "bg-[hsl(var(--sector-cabinet)/0.1)] text-[hsl(var(--sector-cabinet))] border-[hsl(var(--sector-cabinet)/0.3)]"
    )}>
      {isPerso ? "Perso" : "Cabinet"}
    </Badge>
  );
}
