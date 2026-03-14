import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusConfig = {
  paid: { label: "Payé", className: "bg-status-paid-bg text-status-paid border-[hsl(var(--status-paid-border))]" },
  partial: { label: "Partiel", className: "bg-status-partial-bg text-status-partial border-[hsl(var(--status-partial-border))]" },
  pending: { label: "En attente", className: "bg-status-pending-bg text-status-pending border-[hsl(var(--status-pending-border))]" },
  active: { label: "Actif", className: "bg-status-paid-bg text-status-paid border-[hsl(var(--status-paid-border))]" },
  settled: { label: "Soldé", className: "bg-muted text-muted-foreground border-border" },
  late: { label: "En retard", className: "bg-status-pending-bg text-status-pending border-[hsl(var(--status-pending-border))]" },
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status as keyof typeof statusConfig] || { label: status, className: "" };
  return (
    <Badge variant="outline" className={cn("text-xs font-medium", config.className)}>
      {config.label}
    </Badge>
  );
}
