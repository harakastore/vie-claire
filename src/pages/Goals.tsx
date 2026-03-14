import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, ChevronLeft, ChevronRight, Target, Calendar, Star } from "lucide-react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const DAY_NAMES = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

export default function Goals() {
  const { user } = useAuth();
  const now = new Date();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(now, { weekStartsOn: 1 }));

  // Goals
  const [goals90, setGoals90] = useState<any[]>([]);
  const [goalsMonthly, setGoalsMonthly] = useState<any[]>([]);
  const [goalsWeekly, setGoalsWeekly] = useState<any[]>([]);
  const [dailyTasks, setDailyTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New goal inputs
  const [new90, setNew90] = useState("");
  const [newMonthly, setNewMonthly] = useState("");
  const [newWeekly, setNewWeekly] = useState("");
  const [newDailyTexts, setNewDailyTexts] = useState<Record<string, string>>({});

  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: currentWeekStart, end: weekEnd });

  const fetchAll = async () => {
    if (!user) return;
    setLoading(true);
    const wsStr = format(currentWeekStart, "yyyy-MM-dd");
    const weStr = format(weekEnd, "yyyy-MM-dd");

    const [g90, gm, gw, dt] = await Promise.all([
      (supabase.from("goals" as any) as any).select("*").eq("type", "90day").order("created_at"),
      (supabase.from("goals" as any) as any).select("*").eq("type", "monthly").eq("month", currentMonth).eq("year", currentYear).order("created_at"),
      (supabase.from("goals" as any) as any).select("*").eq("type", "weekly").eq("week_start", format(currentWeekStart, "yyyy-MM-dd")).order("created_at"),
      (supabase.from("daily_tasks" as any) as any).select("*").gte("day_date", wsStr).lte("day_date", weStr).order("created_at"),
    ]);
    setGoals90(g90.data || []);
    setGoalsMonthly(gm.data || []);
    setGoalsWeekly(gw.data || []);
    setDailyTasks(dt.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [user, currentWeekStart]);

  // Goal CRUD
  const addGoal = async (type: string, title: string, reset: () => void) => {
    if (!user || !title.trim()) return;
    if (type === "monthly" && goalsMonthly.length >= 3) {
      toast({ title: "Maximum 3 objectifs par mois", variant: "destructive" }); return;
    }
    if (type === "weekly" && goalsWeekly.length >= 3) {
      toast({ title: "Maximum 3 objectifs par semaine", variant: "destructive" }); return;
    }
    const payload: any = {
      user_id: user.id, type, title: title.trim(), status: "todo",
      month: type === "monthly" ? currentMonth : null,
      year: type === "monthly" ? currentYear : null,
      week_start: type === "weekly" ? format(currentWeekStart, "yyyy-MM-dd") : null,
    };
    const { error } = await (supabase.from("goals" as any) as any).insert(payload);
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else { reset(); fetchAll(); }
  };

  const updateGoalStatus = async (id: string, status: string) => {
    await (supabase.from("goals" as any) as any).update({ status }).eq("id", id);
    fetchAll();
  };

  const deleteGoal = async (id: string) => {
    await (supabase.from("goals" as any) as any).delete().eq("id", id);
    fetchAll();
  };

  // Daily tasks
  const addDailyTask = async (dayDate: string) => {
    if (!user) return;
    const text = newDailyTexts[dayDate];
    if (!text?.trim()) return;
    const { error } = await (supabase.from("daily_tasks" as any) as any).insert({ user_id: user.id, title: text.trim(), day_date: dayDate });
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else { setNewDailyTexts((prev) => ({ ...prev, [dayDate]: "" })); fetchAll(); }
  };

  const toggleDailyTask = async (id: string, completed: boolean) => {
    await (supabase.from("daily_tasks" as any) as any).update({ completed: !completed }).eq("id", id);
    fetchAll();
  };

  const deleteDailyTask = async (id: string) => {
    await (supabase.from("daily_tasks" as any) as any).delete().eq("id", id);
    fetchAll();
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Objectifs & Tâches" />
        <div className="grid gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Objectifs & Tâches" description="Planifiez vos objectifs et tâches quotidiennes" />

      {/* 90-day goals */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Target className="h-4 w-4" style={{ color: "hsl(var(--kpi-credits))" }} />
            Objectifs 90 jours
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {goals90.map((g: any) => (
            <div key={g.id} className="flex items-center gap-2 group">
              <Select value={g.status} onValueChange={(v) => updateGoalStatus(g.id, v)}>
                <SelectTrigger className="w-24 h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">À faire</SelectItem>
                  <SelectItem value="in_progress">En cours</SelectItem>
                  <SelectItem value="achieved">Atteint</SelectItem>
                </SelectContent>
              </Select>
              <span className={cn("flex-1 text-sm", g.status === "achieved" && "line-through text-muted-foreground")}>{g.title}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => deleteGoal(g.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <Input placeholder="Nouvel objectif 90 jours..." value={new90} onChange={(e) => setNew90(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addGoal("90day", new90, () => setNew90(""))} className="h-8 text-sm" />
            <Button size="sm" variant="outline" className="h-8" onClick={() => addGoal("90day", new90, () => setNew90(""))}><Plus className="h-3.5 w-3.5" /></Button>
          </div>
        </CardContent>
      </Card>

      {/* Monthly & Weekly goals side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Monthly */}
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" style={{ color: "hsl(var(--kpi-revenue))" }} />
              Objectifs du mois ({format(now, "MMMM", { locale: fr })}) — {goalsMonthly.length}/3
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {goalsMonthly.map((g: any) => (
              <div key={g.id} className="flex items-center gap-2 group">
                <Select value={g.status} onValueChange={(v) => updateGoalStatus(g.id, v)}>
                  <SelectTrigger className="w-24 h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_progress">En cours</SelectItem>
                    <SelectItem value="achieved">Atteint</SelectItem>
                  </SelectContent>
                </Select>
                <span className={cn("flex-1 text-sm", g.status === "achieved" && "line-through text-muted-foreground")}>{g.title}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => deleteGoal(g.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
              </div>
            ))}
            {goalsMonthly.length < 3 && (
              <div className="flex gap-2 mt-2">
                <Input placeholder="Objectif mensuel..." value={newMonthly} onChange={(e) => setNewMonthly(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addGoal("monthly", newMonthly, () => setNewMonthly(""))} className="h-8 text-sm" />
                <Button size="sm" variant="outline" className="h-8" onClick={() => addGoal("monthly", newMonthly, () => setNewMonthly(""))}><Plus className="h-3.5 w-3.5" /></Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Weekly */}
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Star className="h-4 w-4" style={{ color: "hsl(var(--kpi-suppliers))" }} />
              Objectifs de la semaine — {goalsWeekly.length}/3
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Semaine du {format(currentWeekStart, "d", { locale: fr })} au {format(weekEnd, "d MMMM", { locale: fr })}
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {goalsWeekly.map((g: any) => (
              <div key={g.id} className="flex items-center gap-2 group">
                <Select value={g.status} onValueChange={(v) => updateGoalStatus(g.id, v)}>
                  <SelectTrigger className="w-24 h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">À faire</SelectItem>
                    <SelectItem value="in_progress">En cours</SelectItem>
                    <SelectItem value="achieved">Atteint</SelectItem>
                  </SelectContent>
                </Select>
                <span className={cn("flex-1 text-sm", g.status === "achieved" && "line-through text-muted-foreground")}>{g.title}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => deleteGoal(g.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
              </div>
            ))}
            {goalsWeekly.length < 3 && (
              <div className="flex gap-2 mt-2">
                <Input placeholder="Objectif hebdo..." value={newWeekly} onChange={(e) => setNewWeekly(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addGoal("weekly", newWeekly, () => setNewWeekly(""))} className="h-8 text-sm" />
                <Button size="sm" variant="outline" className="h-8" onClick={() => addGoal("weekly", newWeekly, () => setNewWeekly(""))}><Plus className="h-3.5 w-3.5" /></Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Daily tasks grid */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Tâches quotidiennes</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {format(currentWeekStart, "d MMM", { locale: fr })} — {format(weekEnd, "d MMM yyyy", { locale: fr })}
              </span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day, i) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const isToday = isSameDay(day, now);
              const dayTasks = dailyTasks.filter((t: any) => t.day_date === dateStr);
              return (
                <div key={dateStr} className={cn("rounded-lg border p-2 min-h-[140px] flex flex-col", isToday && "border-primary bg-primary/5")}>
                  <p className={cn("text-xs font-medium mb-1", isToday ? "text-primary" : "text-muted-foreground")}>
                    {DAY_NAMES[i]}
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">{format(day, "d", { locale: fr })}</p>
                  <div className="flex-1 space-y-1">
                    {dayTasks.map((t: any) => (
                      <div key={t.id} className="flex items-start gap-1.5 group">
                        <Checkbox
                          checked={t.completed}
                          onCheckedChange={() => toggleDailyTask(t.id, t.completed)}
                          className="mt-0.5 h-3.5 w-3.5"
                        />
                        <span className={cn("text-xs flex-1 leading-tight", t.completed && "line-through text-muted-foreground")}>{t.title}</span>
                        <button onClick={() => deleteDailyTask(t.id)} className="opacity-0 group-hover:opacity-100 text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <Input
                    placeholder="+"
                    value={newDailyTexts[dateStr] || ""}
                    onChange={(e) => setNewDailyTexts((prev) => ({ ...prev, [dateStr]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && addDailyTask(dateStr)}
                    className="h-6 text-xs mt-1 border-dashed"
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
