import { useState, type ReactNode } from "react";
import { CheckSquare, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

export function GoalChecklistButton({ title, completed, total, children }: {
  title: string; completed: number; total: number; children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return <>
    <Button variant="outline" className="h-11 gap-2 bg-card" onClick={() => setOpen(true)}>
      <CheckSquare className="h-4 w-4 text-primary" />
      <span>{title}</span>
      <span className="text-xs text-muted-foreground tabular-nums">{completed}/{total}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{completed} / {total} faits</p>
          <Progress value={total ? completed / total * 100 : 0} className="h-2" />
        </div>
        <div className="space-y-3 min-w-0">{children}</div>
      </DialogContent>
    </Dialog>
  </>;
}