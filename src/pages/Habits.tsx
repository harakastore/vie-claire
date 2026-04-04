import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SectorBadge } from "@/components/SectorBadge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EditableText } from "@/components/EditableText";

export default function Habits() {
  const { user } = useAuth();
  const [habits, setHabits] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sectorFilter, setSectorFilter] = useState("all");

  const now = new Date();
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const [viewYear, setViewYear] = useState(now.getFullYear());

  // Form
  const [title, setTitle] = useState("");
  const [sector, setSector] = useState("perso");

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const [hRes, lRes] = await Promise.all([
      supabase.from("habits").select("*").eq("active", true).order("created_at"),
      supabase.from("habit_logs").select("*").eq("month", viewMonth).eq("year", viewYear),
    ]);
    setHabits(hRes.data || []);
    setLogs(lRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user, viewMonth, viewYear]);

  const filteredHabits = sectorFilter === "all" ? habits : habits.filter((h) => h.sector === sectorFilter);
  const completedCount = filteredHabits.filter((h) => logs.find((l) => l.habit_id === h.id && l.completed)).length;
  const progressPct = filteredHabits.length > 0 ? (completedCount / filteredHabits.length) * 100 : 0;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("habits").insert({ user_id: user.id, title: title.trim(), sector });
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else { toast({ title: "Habitude ajoutée" }); setTitle(""); setSheetOpen(false); fetchData(); }
    setSaving(false);
  };

  const toggleLog = async (habitId: string, currentlyCompleted: boolean) => {
    if (!user) return;
    const existing = logs.find((l) => l.habit_id === habitId);
    if (existing) {
      await supabase.from("habit_logs").update({ completed: !currentlyCompleted, completed_at: !currentlyCompleted ? new Date().toISOString() : null }).eq("id", existing.id);
    } else {
      await supabase.from("habit_logs").insert({ habit_id: habitId, user_id: user.id, month: viewMonth, year: viewYear, completed: true, completed_at: new Date().toISOString() });
    }
    fetchData();
  };

  const deleteHabit = async (id: string) => {
    await supabase.from("habits").update({ active: false }).eq("id", id);
    toast({ title: "Habitude supprimée" });
    fetchData();
  };

  const renameHabit = async (id: string, newTitle: string) => {
    setHabits((prev) => prev.map((h) => h.id === id ? { ...h, title: newTitle } : h));
    await supabase.from("habits").update({ title: newTitle }).eq("id", id);
  };

  const prevMonth = () => {
    if (viewMonth === 1) { setViewMonth(12); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 12) { setViewMonth(1); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Habitudes mensuelles" description="Suivez vos tâches récurrentes">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />Ajouter</Button></SheetTrigger>
          <SheetContent>
            <SheetHeader><SheetTitle>Nouvelle habitude</SheetTitle></SheetHeader>
            <form onSubmit={handleAdd} className="space-y-4 mt-6">
              <div className="space-y-2"><Label>Titre</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Payer loyer" required /></div>
              <div className="space-y-2"><Label>Secteur</Label>
                <Select value={sector} onValueChange={setSector}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="perso">Vie Perso</SelectItem><SelectItem value="cabinet">Cabinet</SelectItem></SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Ajouter</Button>
            </form>
          </SheetContent>
        </Sheet>
      </PageHeader>

      {/* Month navigation */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="text-sm font-medium min-w-[140px] text-center">{monthNames[viewMonth - 1]} {viewYear}</span>
        <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
        <Select value={sectorFilter} onValueChange={setSectorFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Tous</SelectItem><SelectItem value="perso">Perso</SelectItem><SelectItem value="cabinet">Cabinet</SelectItem></SelectContent>
        </Select>
      </div>

      {/* Progress */}
      <Card className="kpi-card">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">{completedCount}/{filteredHabits.length} complétées</span>
            <span className="text-sm text-muted-foreground tabular-nums">{Math.round(progressPct)}%</span>
          </div>
          <Progress value={progressPct} className="h-1.5" />
        </CardContent>
      </Card>

      {/* Habits list */}
      {loading ? <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div> :
        filteredHabits.length === 0 ? <div className="text-center py-12 text-sm text-muted-foreground">Aucune habitude. Créez-en une !</div> :
        <div className="space-y-2">
          {filteredHabits.map((h) => {
            const log = logs.find((l) => l.habit_id === h.id);
            const completed = log?.completed ?? false;
            return (
              <Card key={h.id} className="glass-card">
                <CardContent className="p-4 flex items-center gap-4">
                  <Checkbox checked={completed} onCheckedChange={() => toggleLog(h.id, completed)} />
                  <EditableText value={h.title} onSave={(v) => renameHabit(h.id, v)} className={`flex-1 text-sm ${completed ? "line-through text-muted-foreground" : ""}`} />
                  <SectorBadge sector={h.sector} />
                  <Button variant="ghost" size="icon" onClick={() => deleteHabit(h.id)}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      }
    </div>
  );
}
