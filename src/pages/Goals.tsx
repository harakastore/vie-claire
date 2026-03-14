import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, ChevronLeft, ChevronRight, Target, Calendar, Star, Pencil, ChevronDown, ChevronUp, Eye, EyeOff, Clock, Settings2 } from "lucide-react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const DAY_NAMES = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

const BLOCKS = [
  { key: "fajr_dhuhr", label: "Fajr → Dhuhr", from: "fajr", to: "dhuhr", color: "hsl(200, 60%, 50%)" },
  { key: "dhuhr_asr", label: "Dhuhr → Asr", from: "dhuhr", to: "asr", color: "hsl(40, 70%, 50%)" },
  { key: "asr_maghrib", label: "Asr → Maghrib", from: "asr", to: "maghrib", color: "hsl(25, 70%, 55%)" },
  { key: "maghrib_isha", label: "Maghrib → Isha", from: "maghrib", to: "isha", color: "hsl(260, 50%, 55%)" },
];

const DEFAULT_SALAT = { fajr: "06:00", dhuhr: "13:00", asr: "16:30", maghrib: "18:30", isha: "20:00" };

function calcDuration(from: string, to: string): string {
  const [h1, m1] = from.split(":").map(Number);
  const [h2, m2] = to.split(":").map(Number);
  let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (diff < 0) diff += 24 * 60;
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  return hours > 0 ? `${hours}h${mins > 0 ? mins.toString().padStart(2, "0") : ""}` : `${mins}min`;
}

export default function Goals() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const now = new Date();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(now, { weekStartsOn: 1 }));
  const [showAllDays, setShowAllDays] = useState(false);
  const [showGoals, setShowGoals] = useState(false);

  // Goals
  const [goals90, setGoals90] = useState<any[]>([]);
  const [goalsMonthly, setGoalsMonthly] = useState<any[]>([]);
  const [goalsWeekly, setGoalsWeekly] = useState<any[]>([]);
  const [dailyTasks, setDailyTasks] = useState<any[]>([]);
  const [dailyHabits, setDailyHabits] = useState<any[]>([]);
  const [salatTimes, setSalatTimes] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // New inputs
  const [new90, setNew90] = useState("");
  const [newMonthly, setNewMonthly] = useState("");
  const [newWeekly, setNewWeekly] = useState("");
  const [newBlockTexts, setNewBlockTexts] = useState<Record<string, string>>({});
  const [newHabit, setNewHabit] = useState("");
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [editingHabitTitle, setEditingHabitTitle] = useState("");
  const [habitsSheetOpen, setHabitsSheetOpen] = useState(false);
  const [salatSheetOpen, setSalatSheetOpen] = useState(false);
  const [salatForm, setSalatForm] = useState(DEFAULT_SALAT);

  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: currentWeekStart, end: weekEnd });

  const st = salatTimes || DEFAULT_SALAT;

  const fetchAll = async () => {
    if (!user) return;
    setLoading(true);
    const wsStr = format(currentWeekStart, "yyyy-MM-dd");
    const weStr = format(weekEnd, "yyyy-MM-dd");

    const [g90, gm, gw, dt, dh, stRes] = await Promise.all([
      (supabase.from("goals" as any) as any).select("*").eq("type", "90day").order("created_at"),
      (supabase.from("goals" as any) as any).select("*").eq("type", "monthly").eq("month", currentMonth).eq("year", currentYear).order("created_at"),
      (supabase.from("goals" as any) as any).select("*").eq("type", "weekly").eq("week_start", format(currentWeekStart, "yyyy-MM-dd")).order("created_at"),
      (supabase.from("daily_tasks" as any) as any).select("*").gte("day_date", wsStr).lte("day_date", weStr).order("created_at"),
      (supabase.from("daily_habits" as any) as any).select("*").eq("active", true).order("sort_order"),
      (supabase.from("salat_times" as any) as any).select("*").eq("month", currentMonth).eq("year", currentYear).maybeSingle(),
    ]);
    setGoals90(g90.data || []);
    setGoalsMonthly(gm.data || []);
    setGoalsWeekly(gw.data || []);
    setDailyTasks(dt.data || []);
    setDailyHabits(dh.data || []);
    if (stRes.data) {
      setSalatTimes(stRes.data);
      setSalatForm({ fajr: stRes.data.fajr?.slice(0, 5) || DEFAULT_SALAT.fajr, dhuhr: stRes.data.dhuhr?.slice(0, 5) || DEFAULT_SALAT.dhuhr, asr: stRes.data.asr?.slice(0, 5) || DEFAULT_SALAT.asr, maghrib: stRes.data.maghrib?.slice(0, 5) || DEFAULT_SALAT.maghrib, isha: stRes.data.isha?.slice(0, 5) || DEFAULT_SALAT.isha });
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [user, currentWeekStart]);

  // Salat times save
  const saveSalatTimes = async () => {
    if (!user) return;
    const payload: any = { user_id: user.id, month: currentMonth, year: currentYear, ...salatForm };
    if (salatTimes?.id) {
      await (supabase.from("salat_times" as any) as any).update(salatForm as any).eq("id", salatTimes.id);
    } else {
      await (supabase.from("salat_times" as any) as any).insert(payload);
    }
    toast({ title: "Horaires de salat sauvegardés" });
    setSalatSheetOpen(false);
    fetchAll();
  };

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

  // Daily tasks with block
  const addDailyTask = async (dayDate: string, block: string) => {
    if (!user) return;
    const key = `${dayDate}_${block}`;
    const text = newBlockTexts[key];
    if (!text?.trim()) return;
    const { error } = await (supabase.from("daily_tasks" as any) as any).insert({ user_id: user.id, title: text.trim(), day_date: dayDate, block });
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else { setNewBlockTexts((prev) => ({ ...prev, [key]: "" })); fetchAll(); }
  };

  const toggleDailyTask = async (id: string, completed: boolean) => {
    await (supabase.from("daily_tasks" as any) as any).update({ completed: !completed }).eq("id", id);
    fetchAll();
  };

  const deleteDailyTask = async (id: string) => {
    await (supabase.from("daily_tasks" as any) as any).delete().eq("id", id);
    fetchAll();
  };

  // Daily habits CRUD
  const addDailyHabit = async () => {
    if (!user || !newHabit.trim()) return;
    const { error } = await (supabase.from("daily_habits" as any) as any).insert({
      user_id: user.id, title: newHabit.trim(), sort_order: dailyHabits.length,
    });
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else { setNewHabit(""); fetchAll(); }
  };

  const updateDailyHabit = async (id: string, title: string) => {
    if (!title.trim()) return;
    await (supabase.from("daily_habits" as any) as any).update({ title: title.trim() } as any).eq("id", id);
    setEditingHabitId(null);
    fetchAll();
  };

  const deleteDailyHabit = async (id: string) => {
    await (supabase.from("daily_habits" as any) as any).delete().eq("id", id);
    fetchAll();
  };

  const visibleDays = isMobile && !showAllDays
    ? weekDays.filter((d) => isSameDay(d, now))
    : weekDays;

  const renderDayCard = (day: Date) => {
    const dateStr = format(day, "yyyy-MM-dd");
    const isToday = isSameDay(day, now);
    const dayTasks = dailyTasks.filter((t: any) => t.day_date === dateStr);
    const dayIndex = weekDays.findIndex((d) => isSameDay(d, day));

    return (
      <Card key={dateStr} className={cn(
        "overflow-hidden transition-all",
        isToday ? "border-primary border-2 shadow-lg" : "border-border/50"
      )}>
        {/* Day header */}
        <div className={cn(
          "px-4 py-3 flex items-center justify-between",
          isToday ? "bg-primary/10" : "bg-muted/30"
        )}>
          <div className="flex items-center gap-2">
            <span className={cn("text-base font-bold", isToday ? "text-primary" : "text-foreground")}>
              {DAY_NAMES[dayIndex]}
            </span>
            <span className="text-lg font-bold tabular-nums">{format(day, "d", { locale: fr })}</span>
          </div>
          {isToday && (
            <span className="text-[10px] font-medium bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
              Aujourd'hui
            </span>
          )}
        </div>

        <CardContent className="p-0">
          {/* Non-negotiable habits */}
          {dailyHabits.length > 0 && (
            <div className="px-4 py-3 bg-muted/20 border-b border-dashed">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                🔒 Habitudes non négociables
              </p>
              {dailyHabits.map((h: any) => (
                <div key={h.id} className="flex items-center gap-2 py-0.5">
                  <Checkbox className="h-4 w-4" />
                  <span className="text-sm font-medium">{h.title}</span>
                </div>
              ))}
            </div>
          )}

          {/* Salat blocks */}
          {BLOCKS.map((block) => {
            const blockTasks = dayTasks.filter((t: any) => (t.block || "fajr_dhuhr") === block.key);
            const fromTime = (st[block.from as keyof typeof st] || "").toString().slice(0, 5);
            const toTime = (st[block.to as keyof typeof st] || "").toString().slice(0, 5);
            const duration = fromTime && toTime ? calcDuration(fromTime, toTime) : "";
            const inputKey = `${dateStr}_${block.key}`;

            return (
              <div key={block.key} className="border-b last:border-b-0">
                {/* Block header */}
                <div className="px-4 py-2 flex items-center justify-between" style={{ backgroundColor: `${block.color}15` }}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: block.color }} />
                    <span className="text-xs font-semibold" style={{ color: block.color }}>{block.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{fromTime} — {toTime}</span>
                    {duration && <span className="font-semibold ml-1">({duration})</span>}
                  </div>
                </div>

                {/* Block tasks */}
                <div className="px-4 py-2 space-y-1.5 min-h-[40px]">
                  {blockTasks.map((t: any) => (
                    <div key={t.id} className="flex items-start gap-2 group">
                      <Checkbox
                        checked={t.completed}
                        onCheckedChange={() => toggleDailyTask(t.id, t.completed)}
                        className="mt-0.5 h-4 w-4"
                      />
                      <span className={cn("text-sm flex-1 leading-snug", t.completed && "line-through text-muted-foreground")}>{t.title}</span>
                      <button onClick={() => deleteDailyTask(t.id)} className="opacity-0 group-hover:opacity-100 text-destructive shrink-0">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <Input
                    placeholder="+ tâche"
                    value={newBlockTexts[inputKey] || ""}
                    onChange={(e) => setNewBlockTexts((prev) => ({ ...prev, [inputKey]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && addDailyTask(dateStr, block.key)}
                    className="h-7 text-xs border-dashed bg-transparent"
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
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

      {/* Toggle goals visibility */}
      <Button
        variant="outline"
        className="w-full justify-between"
        onClick={() => setShowGoals(!showGoals)}
      >
        <span className="flex items-center gap-2">
          <Target className="h-4 w-4" />
          Objectifs (90 jours, mois, semaine)
        </span>
        {showGoals ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>

      {showGoals && (
        <>
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

          {/* Monthly & Weekly goals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        </>
      )}

      {/* Daily tasks with salat blocks */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base font-semibold">Tâches quotidiennes</CardTitle>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setHabitsSheetOpen(true)}>
                <Star className="h-3.5 w-3.5 mr-1" /> Habitudes
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setSalatSheetOpen(true)}>
                <Settings2 className="h-3.5 w-3.5 mr-1" /> Horaires Salat
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                {format(currentWeekStart, "d MMM", { locale: fr })} — {format(weekEnd, "d MMM yyyy", { locale: fr })}
              </span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className={cn(
            "grid gap-4",
            isMobile ? "grid-cols-1" : "grid-cols-2 xl:grid-cols-3"
          )}>
            {visibleDays.map((day) => renderDayCard(day))}
          </div>

          {isMobile && (
            <Button
              variant="outline"
              className="w-full mt-3"
              onClick={() => setShowAllDays(!showAllDays)}
            >
              {showAllDays ? (
                <><ChevronUp className="h-4 w-4 mr-2" /> Voir seulement aujourd'hui</>
              ) : (
                <><ChevronDown className="h-4 w-4 mr-2" /> Voir tous les jours de la semaine</>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Salat times sheet */}
      <Sheet open={salatSheetOpen} onOpenChange={setSalatSheetOpen}>
        <SheetContent className="overflow-auto">
          <SheetHeader>
            <SheetTitle>Horaires de Salat — {format(now, "MMMM yyyy", { locale: fr })}</SheetTitle>
          </SheetHeader>
          <p className="text-sm text-muted-foreground mt-2 mb-4">
            Saisissez les horaires de prière pour ce mois. Les blocs de tâches seront calculés automatiquement.
          </p>
          <div className="space-y-4">
            {(["fajr", "dhuhr", "asr", "maghrib", "isha"] as const).map((prayer) => (
              <div key={prayer} className="space-y-1">
                <Label className="capitalize font-semibold">{prayer === "fajr" ? "Fajr (الفجر)" : prayer === "dhuhr" ? "Dhuhr (الظهر)" : prayer === "asr" ? "Asr (العصر)" : prayer === "maghrib" ? "Maghrib (المغرب)" : "Isha (العشاء)"}</Label>
                <Input
                  type="time"
                  value={salatForm[prayer]}
                  onChange={(e) => setSalatForm((prev) => ({ ...prev, [prayer]: e.target.value }))}
                  className="h-10"
                />
              </div>
            ))}
            <div className="pt-3 border-t space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Blocs calculés :</p>
              {BLOCKS.map((b) => (
                <div key={b.key} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: b.color }} />
                    <span>{b.label}</span>
                  </div>
                  <span className="font-semibold tabular-nums">
                    {calcDuration(salatForm[b.from as keyof typeof salatForm], salatForm[b.to as keyof typeof salatForm])}
                  </span>
                </div>
              ))}
            </div>
            <Button className="w-full" onClick={saveSalatTimes}>Sauvegarder</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Habits management sheet */}
      <Sheet open={habitsSheetOpen} onOpenChange={setHabitsSheetOpen}>
        <SheetContent className="overflow-auto">
          <SheetHeader>
            <SheetTitle>Habitudes journalières non négociables</SheetTitle>
          </SheetHeader>
          <p className="text-sm text-muted-foreground mt-2 mb-4">
            Ces habitudes apparaissent automatiquement chaque jour.
          </p>
          <div className="space-y-3">
            {dailyHabits.map((h: any) => (
              <div key={h.id} className="flex items-center gap-2 group">
                {editingHabitId === h.id ? (
                  <Input
                    autoFocus
                    value={editingHabitTitle}
                    onChange={(e) => setEditingHabitTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") updateDailyHabit(h.id, editingHabitTitle);
                      if (e.key === "Escape") setEditingHabitId(null);
                    }}
                    onBlur={() => updateDailyHabit(h.id, editingHabitTitle)}
                    className="h-9 text-sm"
                  />
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium">{h.title}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingHabitId(h.id); setEditingHabitTitle(h.title); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteDailyHabit(h.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </>
                )}
              </div>
            ))}
            <div className="flex gap-2 pt-2 border-t">
              <Input
                placeholder="Nouvelle habitude..."
                value={newHabit}
                onChange={(e) => setNewHabit(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addDailyHabit()}
                className="h-9 text-sm"
              />
              <Button size="sm" className="h-9" onClick={addDailyHabit}><Plus className="h-4 w-4" /></Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
