import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { AutocompleteInput, saveAutocomplete } from "@/components/AutocompleteInput";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "@/hooks/use-toast";
import { Plus, CalendarIcon, Loader2, Pencil, Trash2, AlertCircle } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const priorityConfig = {
  high: { label: "Haute", className: "bg-status-pending-bg text-status-pending border-[hsl(var(--status-pending-border))]" },
  medium: { label: "Moyenne", className: "bg-status-partial-bg text-status-partial border-[hsl(var(--status-partial-border))]" },
  low: { label: "Basse", className: "bg-muted text-muted-foreground" },
};

const statusLabels: Record<string, string> = { todo: "À faire", in_progress: "En cours", done: "Fait" };

export default function Engagements() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("");

  // Form
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [priority, setPriority] = useState("medium");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("todo");

  const fetchTasks = async () => {
    if (!user) return;
    setLoading(true);
    let q = supabase.from("tasks").select("*").order("due_date", { ascending: true, nullsFirst: false });
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    if (categoryFilter) q = q.ilike("category", `%${categoryFilter}%`);
    const { data } = await q;
    setTasks(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchTasks(); }, [user, statusFilter, categoryFilter]);

  const resetForm = () => { setTitle(""); setDueDate(undefined); setPriority("medium"); setCategory(""); setStatus("todo"); setEditId(null); };

  const openEdit = (t: any) => {
    setEditId(t.id); setTitle(t.title); setDueDate(t.due_date ? new Date(t.due_date) : undefined);
    setPriority(t.priority); setCategory(t.category || ""); setStatus(t.status); setSheetOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim()) return;
    setSaving(true);
    const payload = {
      user_id: user.id, title: title.trim(), due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
      priority, category: category.trim() || null, status,
    };
    const { error } = editId
      ? await supabase.from("tasks").update(payload).eq("id", editId)
      : await supabase.from("tasks").insert(payload);
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else {
      if (category.trim()) saveAutocomplete(user.id, "task_category", category.trim());
      toast({ title: editId ? "Tâche modifiée" : "Tâche ajoutée" });
      resetForm(); setSheetOpen(false); fetchTasks();
    }
    setSaving(false);
  };

  const deleteTask = async (id: string) => {
    await supabase.from("tasks").delete().eq("id", id);
    toast({ title: "Tâche supprimée" });
    fetchTasks();
  };

  const quickStatus = async (id: string, newStatus: string) => {
    await supabase.from("tasks").update({ status: newStatus }).eq("id", id);
    fetchTasks();
  };

  const getUrgency = (dueDateStr: string | null) => {
    if (!dueDateStr) return null;
    const days = differenceInDays(new Date(dueDateStr), new Date());
    if (days < 0) return "overdue";
    if (days <= 7) return "soon";
    return null;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Engagements & Tâches" description="Vos obligations et projets à venir">
        <Sheet open={sheetOpen} onOpenChange={(o) => { setSheetOpen(o); if (!o) resetForm(); }}>
          <SheetTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />Ajouter</Button></SheetTrigger>
          <SheetContent>
            <SheetHeader><SheetTitle>{editId ? "Modifier" : "Nouvelle tâche"}</SheetTitle></SheetHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-6">
              <div className="space-y-2"><Label>Titre</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Ex: Déclaration bilan avril" /></div>
              <div className="space-y-2"><Label>Échéance</Label>
                <Popover><PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start", !dueDate && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{dueDate ? format(dueDate, "PPP", { locale: fr }) : "Optionnel"}</Button>
                </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus className="p-3 pointer-events-auto" /></PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2"><Label>Priorité</Label>
                <Select value={priority} onValueChange={setPriority}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="high">Haute</SelectItem><SelectItem value="medium">Moyenne</SelectItem><SelectItem value="low">Basse</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Catégorie</Label>
                <AutocompleteInput fieldType="task_category" value={category} onChange={setCategory} placeholder="Ex: admin, fiscal..." />
              </div>
              <div className="space-y-2"><Label>Statut</Label>
                <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="todo">À faire</SelectItem><SelectItem value="in_progress">En cours</SelectItem><SelectItem value="done">Fait</SelectItem></SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editId ? "Modifier" : "Ajouter"}</Button>
            </form>
          </SheetContent>
        </Sheet>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Tous</SelectItem><SelectItem value="todo">À faire</SelectItem><SelectItem value="in_progress">En cours</SelectItem><SelectItem value="done">Fait</SelectItem></SelectContent>
        </Select>
        <Input placeholder="Filtrer catégorie..." value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-48" />
      </div>

      {/* Tasks list */}
      {loading ? <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div> :
        tasks.length === 0 ? <div className="text-center py-12 text-sm text-muted-foreground">Aucune tâche.</div> :
        <div className="space-y-2">
          {tasks.map((t) => {
            const urgency = getUrgency(t.due_date);
            const pConfig = priorityConfig[t.priority as keyof typeof priorityConfig];
            return (
              <Card key={t.id} className={cn("glass-card", urgency === "overdue" && "border-destructive/30")}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-sm font-medium", t.status === "done" && "line-through text-muted-foreground")}>{t.title}</span>
                      {urgency === "overdue" && <AlertCircle className="h-4 w-4 text-destructive shrink-0" />}
                      {urgency === "soon" && <AlertCircle className="h-4 w-4 text-status-partial shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {t.due_date && <span className={cn("text-xs", urgency === "overdue" ? "text-destructive" : urgency === "soon" ? "text-status-partial" : "text-muted-foreground")}>{format(new Date(t.due_date), "dd/MM/yyyy")}</span>}
                      {t.category && <span className="text-xs text-muted-foreground">• {t.category}</span>}
                    </div>
                  </div>
                  <Badge variant="outline" className={cn("text-xs shrink-0", pConfig.className)}>{pConfig.label}</Badge>
                  <Select value={t.status} onValueChange={(v) => quickStatus(t.id, v)}>
                    <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="todo">À faire</SelectItem><SelectItem value="in_progress">En cours</SelectItem><SelectItem value="done">Fait</SelectItem></SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteTask(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      }
    </div>
  );
}
