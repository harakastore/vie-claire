import { useEffect, useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Pencil, Rocket, ChevronLeft, ChevronRight, Flame, Trophy, CalendarDays } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import disciplineHero from "@/assets/discipline-hero.png";

const DAY_LABELS = ["D", "L", "M", "M", "J", "V", "S"];
const habitVisibleOnDate = (h: any, dateStr: string) => {
  const days = h.days_of_week as number[] | null | undefined;
  if (!days || days.length === 0) return true;
  const dow = new Date(dateStr + "T00:00:00").getDay();
  return days.includes(dow);
};

const CATEGORY = "business";
const COLOR = "hsl(28, 90%, 55%)";
const COLOR_DARK = "hsl(28, 85%, 40%)";
const BG = "hsl(28, 95%, 96%)";

export default function BusinessRoutine() {
  const { user } = useAuth();
  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");

  const [monthCursor, setMonthCursor] = useState<Date>(startOfMonth(now));
  const monthStart = startOfMonth(monthCursor);
  const monthEnd = endOfMonth(monthCursor);
  const monthFromStr = format(monthStart, "yyyy-MM-dd");
  const monthToStr = format(monthEnd, "yyyy-MM-dd");
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const [habits, setHabits] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newDays, setNewDays] = useState<number[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const fetchAll = async () => {
    if (!user) return;
    setLoading(true);
    const [h, l] = await Promise.all([
      (supabase.from("daily_habits" as any) as any).select("*").eq("active", true).eq("category", CATEGORY).order("sort_order"),
      (supabase.from("daily_habit_logs" as any) as any).select("*").gte("day_date", monthFromStr).lte("day_date", monthToStr),
    ]);
    setHabits(h.data || []);
    setLogs(l.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [user, monthFromStr, monthToStr]);

  const isDone = (habitId: string, dateStr: string) =>
    logs.some((l: any) => l.habit_id === habitId && l.day_date === dateStr && l.completed);

  const toggle = async (habitId: string, dateStr: string) => {
    if (!user) return;
    const existing = logs.find((l: any) => l.habit_id === habitId && l.day_date === dateStr);
    if (existing) {
      const nv = !existing.completed;
      setLogs((p) => p.map((l) => l.id === existing.id ? { ...l, completed: nv } : l));
      await (supabase.from("daily_habit_logs" as any) as any).update({ completed: nv }).eq("id", existing.id);
    } else {
      const tmp = `temp-${Date.now()}`;
      setLogs((p) => [...p, { id: tmp, user_id: user.id, habit_id: habitId, day_date: dateStr, completed: true }]);
      const { data } = await (supabase.from("daily_habit_logs" as any) as any)
        .insert({ user_id: user.id, habit_id: habitId, day_date: dateStr, completed: true })
        .select().single();
      if (data) setLogs((p) => p.map((l) => l.id === tmp ? data : l));
    }
  };

  const addHabit = async () => {
    if (!user || !newTitle.trim()) return;
    const title = newTitle.trim();
    const days = newDays.length > 0 ? newDays : null;
    const tmp = `temp-${Date.now()}`;
    setHabits((p) => [...p, { id: tmp, user_id: user.id, title, sort_order: habits.length, active: true, category: CATEGORY, days_of_week: days }]);
    setNewTitle(""); setNewDays([]);
    const { data, error } = await (supabase.from("daily_habits" as any) as any)
      .insert({ user_id: user.id, title, sort_order: habits.length, category: CATEGORY, days_of_week: days })
      .select().single();
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); fetchAll(); }
    else if (data) setHabits((p) => p.map((h) => h.id === tmp ? data : h));
  };

  const toggleHabitDay = async (h: any, dow: number) => {
    const days: number[] = h.days_of_week || [];
    const next = days.includes(dow) ? days.filter((d) => d !== dow) : [...days, dow].sort();
    setHabits((p) => p.map((x) => x.id === h.id ? { ...x, days_of_week: next.length ? next : null } : x));
    await (supabase.from("daily_habits" as any) as any).update({ days_of_week: next.length ? next : null }).eq("id", h.id);
  };

  const deleteHabit = async (id: string) => {
    setHabits((p) => p.filter((h) => h.id !== id));
    await (supabase.from("daily_habits" as any) as any).delete().eq("id", id);
  };

  const rename = async (id: string, title: string) => {
    if (!title.trim()) { setEditingId(null); return; }
    setHabits((p) => p.map((h) => h.id === id ? { ...h, title: title.trim() } : h));
    setEditingId(null);
    await (supabase.from("daily_habits" as any) as any).update({ title: title.trim() }).eq("id", id);
  };

  const doneToday = habits.filter((h) => habitVisibleOnDate(h, todayStr) && isDone(h.id, todayStr)).length;
  const totalToday = habits.filter((h) => habitVisibleOnDate(h, todayStr)).length;
  const pctToday = totalToday > 0 ? Math.round((doneToday / totalToday) * 100) : 0;

  const monthStats = useMemo(() => {
    const validDays = monthDays.filter((d) => d <= now);
    let done = 0; let total = 0;
    habits.forEach((h) => {
      validDays.forEach((d) => {
        const ds = format(d, "yyyy-MM-dd");
        if (!habitVisibleOnDate(h, ds)) return;
        total++;
        if (isDone(h.id, ds)) done++;
      });
    });
    return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  }, [habits, logs, monthDays]);

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <PageHeader title="🚀 Business Daily Routine" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Hero */}
      <div
        className="rounded-2xl p-5 shadow-lg text-white relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, hsl(20, 90%, 45%), hsl(35, 95%, 50%))" }}
      >
        <div className="absolute -top-8 -right-8 opacity-10"><Rocket className="h-40 w-40" /></div>
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <img src={disciplineHero} alt="Business" className="h-32 w-32 sm:h-40 sm:w-40 rounded-2xl object-cover ring-4 ring-white/40 shadow-2xl shrink-0" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">🚀 Business Daily Routine</h1>
              <p className="text-sm opacity-90 mt-1">Tâches récurrentes business — {format(now, "EEEE d MMMM yyyy", { locale: fr })}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white/15 backdrop-blur rounded-xl px-4 py-2.5">
            <Trophy className="h-5 w-5 text-yellow-300" />
            <div>
              <p className="text-[10px] uppercase tracking-wider opacity-80">Ce mois</p>
              <p className="text-xl font-black tabular-nums">{monthStats.pct}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Today checklist */}
      <Card className="overflow-hidden border-2" style={{ borderColor: `${COLOR}60` }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: BG }}>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: COLOR }}>
              <Rocket className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-wider" style={{ color: COLOR_DARK }}>Aujourd'hui</p>
              <p className="text-[10px] text-muted-foreground">{doneToday}/{totalToday} aujourd'hui · {habits.length} total</p>
            </div>
          </div>
          <p className="text-2xl font-black tabular-nums" style={{ color: COLOR }}>{pctToday}%</p>
        </div>
        <CardContent className="pt-4 space-y-2">
          {(() => {
            const todayList = habits.filter((h) => habitVisibleOnDate(h, todayStr));
            if (todayList.length === 0) {
              return <p className="text-sm text-muted-foreground text-center py-6">Aucune routine pour aujourd'hui.</p>;
            }
            return todayList.map((h) => {
              const done = isDone(h.id, todayStr);
              return (
                <div key={h.id} className="group flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-muted/40">
                  <Checkbox checked={done} onCheckedChange={() => toggle(h.id, todayStr)} className="h-4 w-4 mt-0.5" />
                  {editingId === h.id ? (
                    <Input autoFocus value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={() => rename(h.id, editingTitle)}
                      onKeyDown={(e) => { if (e.key === "Enter") rename(h.id, editingTitle); if (e.key === "Escape") setEditingId(null); }}
                      className="h-7 text-sm flex-1" />
                  ) : (
                    <span
                      className={cn("text-sm font-medium flex-1 cursor-text", done && "line-through text-muted-foreground")}
                      onDoubleClick={() => { setEditingId(h.id); setEditingTitle(h.title); }}
                    >{h.title}</span>
                  )}
                  {h.days_of_week && h.days_of_week.length > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">
                      {h.days_of_week.map((d: number) => DAY_LABELS[d]).join("")}
                    </span>
                  )}
                  <button onClick={() => { setEditingId(h.id); setEditingTitle(h.title); }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground">
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button onClick={() => deleteHabit(h.id)} className="opacity-0 group-hover:opacity-100 text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            });
          })()}

          {/* Manage days for all recurring habits */}
          {habits.length > 0 && (
            <details className="border-t pt-2 mt-2">
              <summary className="text-[10px] uppercase tracking-wider font-bold cursor-pointer text-muted-foreground hover:text-foreground">
                ⚙️ Gérer les jours de chaque routine ({habits.length})
              </summary>
              <div className="mt-2 space-y-2">
                {habits.map((h) => (
                  <div key={`mgr-${h.id}`} className="border rounded-md p-2 space-y-1.5 bg-background">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium flex-1">{h.title}</span>
                      <span className="text-[9px] text-muted-foreground">
                        {(!h.days_of_week || h.days_of_week.length === 0) ? "Tous les jours" : ""}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {DAY_LABELS.map((lbl, dow) => {
                        const active = (h.days_of_week || []).includes(dow);
                        return (
                          <button key={dow} onClick={() => toggleHabitDay(h, dow)}
                            className={cn("h-6 w-6 rounded text-[10px] font-bold border transition-colors",
                              active ? "text-white" : "bg-background text-muted-foreground hover:bg-muted")}
                            style={active ? { backgroundColor: COLOR, borderColor: COLOR } : undefined}
                          >{lbl}</button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Add form */}
          <div className="border-t pt-3 space-y-2">
            <div className="flex gap-1 flex-wrap items-center">
              <span className="text-[10px] text-muted-foreground mr-1 flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Jours (vide = tous):</span>
              {DAY_LABELS.map((lbl, dow) => {
                const active = newDays.includes(dow);
                return (
                  <button key={dow}
                    onClick={() => setNewDays((p) => p.includes(dow) ? p.filter((d) => d !== dow) : [...p, dow].sort())}
                    className={cn("h-6 w-6 rounded text-[10px] font-bold border transition-colors",
                      active ? "text-white" : "bg-background text-muted-foreground hover:bg-muted")}
                    style={active ? { backgroundColor: COLOR, borderColor: COLOR } : undefined}
                  >{lbl}</button>
                );
              })}
            </div>
            <div className="flex gap-1.5">
              <Input
                placeholder="+ Nouvelle routine business..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addHabit()}
                className="h-8 text-xs"
              />
              <Button size="sm" className="h-8 px-2.5 text-white" style={{ backgroundColor: COLOR }} onClick={addHabit}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>


      {/* Monthly dashboard */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/20 border-b">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              📊 Dashboard mensuel
              <span className="text-xs font-normal text-muted-foreground capitalize">— {format(monthCursor, "MMMM yyyy", { locale: fr })}</span>
              <span className="text-xs font-bold text-orange-600 flex items-center gap-1"><Flame className="h-3 w-3" /> {monthStats.done}/{monthStats.total}</span>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMonthCursor(subMonths(monthCursor, 1))}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setMonthCursor(startOfMonth(now))}>Ce mois</Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMonthCursor(addMonths(monthCursor, 1))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {habits.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucune routine.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="border border-border/50 px-2 py-2 text-xs font-bold text-left sticky left-0 bg-background z-10 min-w-[160px]">Routine</th>
                    {monthDays.map((d) => (
                      <th key={format(d, "yyyy-MM-dd")} className={cn(
                        "border border-border/50 px-1 py-1.5 text-[9px] font-bold text-center min-w-[28px]",
                        isSameDay(d, now) && "bg-primary/15 text-primary"
                      )}>
                        <div className="leading-none">{format(d, "EEEEE", { locale: fr })}</div>
                        <div className="tabular-nums leading-none mt-0.5">{format(d, "d")}</div>
                      </th>
                    ))}
                    <th className="border border-border/50 px-2 py-2 text-xs font-bold text-center min-w-[50px]">%</th>
                  </tr>
                </thead>
                <tbody>
                  {habits.map((h) => {
                    const validDays = monthDays.filter((d) => d <= now && habitVisibleOnDate(h, format(d, "yyyy-MM-dd")));
                    const completed = validDays.filter((d) => isDone(h.id, format(d, "yyyy-MM-dd"))).length;
                    const pct = validDays.length > 0 ? Math.round((completed / validDays.length) * 100) : 0;
                    return (
                      <tr key={h.id} className="hover:bg-muted/30">
                        <td className="border border-border/50 px-2 py-1 text-xs font-medium sticky left-0 bg-background z-10 whitespace-nowrap">{h.title}</td>
                        {monthDays.map((d) => {
                          const ds = format(d, "yyyy-MM-dd");
                          const visible = habitVisibleOnDate(h, ds);
                          const done = isDone(h.id, ds);
                          const isFuture = d > now;
                          return (
                            <td key={ds} className={cn("border border-border/50 text-center p-0", isSameDay(d, now) && "bg-primary/5")}>
                              {!visible ? (
                                <div className="w-full h-7 bg-muted/20" />
                              ) : (
                                <button
                                  disabled={isFuture}
                                  onClick={() => toggle(h.id, ds)}
                                  className={cn(
                                    "w-full h-7 text-xs font-bold transition-colors",
                                    isFuture ? "text-muted-foreground/30 cursor-not-allowed" :
                                    done ? "text-white" : "hover:bg-muted/50 text-muted-foreground"
                                  )}
                                  style={done ? { backgroundColor: COLOR } : undefined}
                                >{done ? "✓" : isFuture ? "" : "·"}</button>
                              )}
                            </td>
                          );
                        })}
                        <td className={cn("border border-border/50 px-2 py-1 text-xs font-black text-center tabular-nums",
                          pct >= 80 ? "text-green-600 bg-green-50" : pct >= 50 ? "text-amber-600 bg-amber-50" : "text-red-500 bg-red-50")}>
                          {pct}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
