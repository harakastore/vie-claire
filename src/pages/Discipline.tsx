import { useEffect, useMemo, useState } from "react";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from "date-fns";
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
import { Plus, Trash2, Pencil, Shield, Briefcase, Repeat, ChevronLeft, ChevronRight, Sparkles, Trophy, Flame } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import disciplineHero from "@/assets/discipline-hero.png";

const DAY_LABELS = ["D", "L", "M", "M", "J", "V", "S"];
const FAJR_KEYWORDS = ["fajr", "al fajr", "alfajr", "salat al fajr", "صلاة الفجر", "الفجر"];

const habitVisibleOnDate = (h: any, dateStr: string) => {
  const days = h.days_of_week as number[] | null | undefined;
  if (!days || days.length === 0) return true;
  const dow = new Date(dateStr + "T00:00:00").getDay();
  return days.includes(dow);
};

const isFajrHabit = (h: any) => {
  const t = (h.title || "").toLowerCase().trim();
  return FAJR_KEYWORDS.some((k) => t.includes(k));
};

type GroupKey = "personal" | "business" | "recurring";

const GROUPS: { key: GroupKey; label: string; icon: any; bg: string; color: string; bar: string }[] = [
  { key: "personal", label: "Personnel", icon: Shield,    bg: "hsl(200, 85%, 96%)", color: "hsl(200, 75%, 35%)", bar: "hsl(200, 75%, 50%)" },
  { key: "business", label: "Business",  icon: Briefcase, bg: "hsl(28, 95%, 95%)",  color: "hsl(28, 85%, 40%)",  bar: "hsl(28, 90%, 55%)" },
  { key: "recurring", label: "Récurrentes", icon: Repeat, bg: "hsl(270, 75%, 96%)", color: "hsl(270, 65%, 40%)", bar: "hsl(270, 70%, 55%)" },
];

export default function Discipline() {
  const { user } = useAuth();
  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");

  const [monthCursor, setMonthCursor] = useState<Date>(startOfMonth(now));
  const monthStart = startOfMonth(monthCursor);
  const monthEnd = endOfMonth(monthCursor);
  const monthFromStr = format(monthStart, "yyyy-MM-dd");
  const monthToStr = format(monthEnd, "yyyy-MM-dd");
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const [dailyHabits, setDailyHabits] = useState<any[]>([]);
  const [habitLogs, setHabitLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Inline add per group
  const [newHabitText, setNewHabitText] = useState<Record<GroupKey, string>>({ personal: "", business: "", recurring: "" });
  const [newHabitDays, setNewHabitDays] = useState<number[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const fetchAll = async () => {
    if (!user) return;
    setLoading(true);
    const [dh, dhl] = await Promise.all([
      (supabase.from("daily_habits" as any) as any).select("*").eq("active", true).order("sort_order"),
      (supabase.from("daily_habit_logs" as any) as any).select("*").gte("day_date", monthFromStr).lte("day_date", monthToStr),
    ]);
    setDailyHabits(dh.data || []);
    setHabitLogs(dhl.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [user, monthFromStr, monthToStr]);

  const isHabitCompleted = (habitId: string, dateStr: string) =>
    habitLogs.some((l: any) => l.habit_id === habitId && l.day_date === dateStr && l.completed);

  const toggleHabitLog = async (habitId: string, dateStr: string) => {
    if (!user) return;
    const existing = habitLogs.find((l: any) => l.habit_id === habitId && l.day_date === dateStr);
    if (existing) {
      const newVal = !existing.completed;
      setHabitLogs((prev) => prev.map((l) => l.id === existing.id ? { ...l, completed: newVal } : l));
      await (supabase.from("daily_habit_logs" as any) as any).update({ completed: newVal }).eq("id", existing.id);
    } else {
      const tempId = `temp-${Date.now()}`;
      const temp = { id: tempId, user_id: user.id, habit_id: habitId, day_date: dateStr, completed: true };
      setHabitLogs((prev) => [...prev, temp]);
      const { data } = await (supabase.from("daily_habit_logs" as any) as any)
        .insert({ user_id: user.id, habit_id: habitId, day_date: dateStr, completed: true })
        .select().single();
      if (data) setHabitLogs((prev) => prev.map((l) => l.id === tempId ? data : l));
    }
  };

  const addHabit = async (group: GroupKey) => {
    if (!user) return;
    const title = newHabitText[group].trim();
    if (!title) return;
    const days = group === "recurring" && newHabitDays.length > 0 ? newHabitDays : null;
    const tempId = `temp-${Date.now()}`;
    const temp = { id: tempId, user_id: user.id, title, sort_order: dailyHabits.length, active: true, category: group, days_of_week: days };
    setDailyHabits((prev) => [...prev, temp]);
    setNewHabitText((p) => ({ ...p, [group]: "" }));
    if (group === "recurring") setNewHabitDays([]);
    const { data, error } = await (supabase.from("daily_habits" as any) as any)
      .insert({ user_id: user.id, title, sort_order: dailyHabits.length, category: group, days_of_week: days })
      .select().single();
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); fetchAll(); }
    else if (data) setDailyHabits((prev) => prev.map((h) => h.id === tempId ? data : h));
  };

  const deleteHabit = async (id: string) => {
    setDailyHabits((prev) => prev.filter((h) => h.id !== id));
    await (supabase.from("daily_habits" as any) as any).delete().eq("id", id);
  };

  const renameHabit = async (id: string, title: string) => {
    if (!title.trim()) { setEditingId(null); return; }
    setDailyHabits((prev) => prev.map((h) => h.id === id ? { ...h, title: title.trim() } : h));
    setEditingId(null);
    await (supabase.from("daily_habits" as any) as any).update({ title: title.trim() }).eq("id", id);
  };

  const toggleRecurringDay = async (h: any, dow: number) => {
    const days: number[] = h.days_of_week || [];
    const next = days.includes(dow) ? days.filter((d) => d !== dow) : [...days, dow].sort();
    setDailyHabits((prev) => prev.map((x) => x.id === h.id ? { ...x, days_of_week: next } : x));
    await (supabase.from("daily_habits" as any) as any).update({ days_of_week: next }).eq("id", h.id);
  };

  // Fajr aggregation (single virtual habit if multiple Fajr titles exist)
  const fajrHabits = useMemo(() => dailyHabits.filter(isFajrHabit), [dailyHabits]);
  const fajrDoneOn = (dateStr: string) => fajrHabits.some((h) => isHabitCompleted(h.id, dateStr));
  const fajrStats = useMemo(() => {
    if (fajrHabits.length === 0) return { done: 0, total: monthDays.length, pct: 0 };
    const today = now;
    const validDays = monthDays.filter((d) => d <= today);
    const done = validDays.filter((d) => fajrDoneOn(format(d, "yyyy-MM-dd"))).length;
    const total = validDays.length;
    return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  }, [fajrHabits, habitLogs, monthDays]);

  const groupedHabits = useMemo(() => {
    const map: Record<GroupKey, any[]> = { personal: [], business: [], recurring: [] };
    dailyHabits.forEach((h) => {
      const cat = (h.category || "personal") as GroupKey;
      if (map[cat]) map[cat].push(h);
    });
    return map;
  }, [dailyHabits]);

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <PageHeader title="🛡️ Discipline" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Hero banner */}
      <div
        className="rounded-2xl p-5 shadow-lg text-white relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, hsl(220, 70%, 45%), hsl(265, 75%, 50%))" }}
      >
        <div className="absolute -top-8 -right-8 opacity-10"><Shield className="h-40 w-40" /></div>
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <img
              src={disciplineHero}
              alt="Discipline"
              className="h-32 w-32 sm:h-40 sm:w-40 rounded-2xl object-cover ring-4 ring-white/40 shadow-2xl shrink-0"
            />
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">🛡️ Discipline absolue</h1>
              <p className="text-sm opacity-90 mt-1">Non-négociables d'aujourd'hui — {format(now, "EEEE d MMMM yyyy", { locale: fr })}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white/15 backdrop-blur rounded-xl px-4 py-2.5">
            <Trophy className="h-5 w-5 text-yellow-300" />
            <div>
              <p className="text-[10px] uppercase tracking-wider opacity-80">Fajr ce mois</p>
              <p className="text-xl font-black tabular-nums">{fajrStats.pct}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* === FAJR SECTION (dédiée, mois courant auto) === */}
      <Card className="border-2 overflow-hidden" style={{ borderColor: "hsl(48, 95%, 60%)" }}>
        <CardHeader
          className="pb-3"
          style={{ background: "linear-gradient(135deg, hsl(48, 100%, 60%), hsl(35, 95%, 55%))" }}
        >
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-lg font-black flex items-center gap-2 text-white">
              🕌 Salat Al Fajr — Suivi mensuel
            </CardTitle>
            <div className="flex items-center gap-3 text-white">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={() => setMonthCursor(subMonths(monthCursor, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-bold capitalize tabular-nums">{format(monthCursor, "MMMM yyyy", { locale: fr })}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={() => setMonthCursor(addMonths(monthCursor, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5 space-y-4" style={{ backgroundColor: "hsl(48, 100%, 98%)" }}>
          {fajrHabits.length === 0 ? (
            <div className="text-center py-6 px-4 rounded-lg border-2 border-dashed" style={{ borderColor: "hsl(48, 80%, 60%)" }}>
              <Sparkles className="h-8 w-8 mx-auto mb-2" style={{ color: "hsl(35, 95%, 50%)" }} />
              <p className="text-sm font-semibold text-foreground">Aucune habitude « Salat Al Fajr » détectée</p>
              <p className="text-xs text-muted-foreground mt-1">Ajoute une habitude contenant le mot « Fajr » dans la section Personnel ci-dessous pour activer ce suivi dédié.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between flex-wrap gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Flame className="h-5 w-5 text-orange-500" />
                  <span className="font-bold tabular-nums">{fajrStats.done}/{fajrStats.total}</span>
                  <span className="text-muted-foreground">jours validés ce mois</span>
                </div>
                <div className="flex-1 max-w-md">
                  <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: "hsl(48, 60%, 90%)" }}>
                    <div className="h-full transition-all rounded-full" style={{ width: `${fajrStats.pct}%`, background: "linear-gradient(90deg, hsl(48, 95%, 55%), hsl(28, 95%, 55%))" }} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-7 sm:grid-cols-10 md:grid-cols-15 lg:grid-cols-[repeat(15,minmax(0,1fr))] gap-1.5">
                {monthDays.map((d) => {
                  const ds = format(d, "yyyy-MM-dd");
                  const isFuture = d > now;
                  const done = fajrDoneOn(ds);
                  const isToday = isSameDay(d, now);
                  return (
                    <button
                      key={ds}
                      disabled={isFuture || fajrHabits.length === 0}
                      onClick={() => fajrHabits.forEach((h) => toggleHabitLog(h.id, ds))}
                      className={cn(
                        "aspect-square rounded-lg border-2 flex flex-col items-center justify-center text-xs font-bold transition-all",
                        isFuture && "opacity-30 cursor-not-allowed",
                        isToday && "ring-2 ring-offset-1 ring-orange-500",
                        done
                          ? "text-white shadow-md"
                          : isFuture
                            ? "bg-muted/30 border-border text-muted-foreground"
                            : "bg-white border-amber-300 hover:border-amber-500 text-amber-700"
                      )}
                      style={done ? { background: "linear-gradient(135deg, hsl(140, 70%, 45%), hsl(160, 70%, 40%))", borderColor: "hsl(140, 70%, 35%)" } : undefined}
                      title={format(d, "EEEE d MMM", { locale: fr })}
                    >
                      <span className="text-[9px] opacity-70 leading-none">{format(d, "EEE", { locale: fr }).slice(0, 1).toUpperCase()}</span>
                      <span className="text-sm leading-none mt-0.5">{format(d, "d")}</span>
                      <span className="text-[10px] leading-none mt-0.5">{done ? "✓" : isFuture ? "" : "·"}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* === NON-NÉGOCIABLES DU JOUR + GESTION CRUD === */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {GROUPS.map(({ key, label, icon: Icon, bg, color, bar }) => {
          const items = groupedHabits[key].filter((h) => key === "recurring" ? habitVisibleOnDate(h, todayStr) : true);
          const allItems = groupedHabits[key];
          const doneToday = items.filter((h) => isHabitCompleted(h.id, todayStr)).length;
          const totalToday = items.length;
          const pctToday = totalToday > 0 ? Math.round((doneToday / totalToday) * 100) : 0;

          return (
            <Card key={key} className="overflow-hidden border-2" style={{ borderColor: `${bar}40` }}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: bg }}>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: bar }}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-black uppercase tracking-wider" style={{ color }}>{label}</p>
                    <p className="text-[10px] text-muted-foreground">{doneToday}/{totalToday} aujourd'hui · {allItems.length} total</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black tabular-nums" style={{ color: bar }}>{pctToday}%</p>
                </div>
              </div>

              <CardContent className="pt-4 space-y-2">
                {/* Today checklist */}
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic text-center py-2">Aucune pour aujourd'hui</p>
                ) : (
                  items.map((h) => {
                    const done = isHabitCompleted(h.id, todayStr);
                    return (
                      <div key={h.id} className="group flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-muted/40 transition-colors">
                        <Checkbox checked={done} onCheckedChange={() => toggleHabitLog(h.id, todayStr)} className="h-4 w-4 mt-0.5" />
                        {editingId === h.id ? (
                          <Input
                            autoFocus value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onBlur={() => renameHabit(h.id, editingTitle)}
                            onKeyDown={(e) => { if (e.key === "Enter") renameHabit(h.id, editingTitle); if (e.key === "Escape") setEditingId(null); }}
                            className="h-7 text-sm flex-1"
                          />
                        ) : (
                          <span
                            className={cn("text-sm font-medium flex-1 cursor-text", done && "line-through text-muted-foreground")}
                            onDoubleClick={() => { setEditingId(h.id); setEditingTitle(h.title); }}
                          >
                            {h.title}
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
                  })
                )}

                {/* Show all (including non-visible recurring today) for management */}
                {key === "recurring" && groupedHabits.recurring.length > 0 && (
                  <details className="border-t pt-2 mt-2">
                    <summary className="text-[10px] uppercase tracking-wider font-bold cursor-pointer text-muted-foreground hover:text-foreground">⚙️ Gérer toutes les récurrentes ({groupedHabits.recurring.length})</summary>
                    <div className="mt-2 space-y-2">
                      {groupedHabits.recurring.map((h) => (
                        <div key={`mgr-${h.id}`} className="border rounded-md p-2 space-y-1.5 bg-background">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium flex-1">{h.title}</span>
                            <button onClick={() => deleteHabit(h.id)} className="text-destructive"><Trash2 className="h-3 w-3" /></button>
                          </div>
                          <div className="flex gap-1">
                            {DAY_LABELS.map((lbl, dow) => (
                              <button
                                key={dow} onClick={() => toggleRecurringDay(h, dow)}
                                className={cn(
                                  "h-6 w-6 rounded text-[10px] font-bold border transition-colors",
                                  (h.days_of_week || []).includes(dow)
                                    ? "text-white"
                                    : "bg-background text-muted-foreground hover:bg-muted"
                                )}
                                style={(h.days_of_week || []).includes(dow) ? { backgroundColor: bar, borderColor: bar } : undefined}
                              >{lbl}</button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {/* Inline add */}
                <div className="border-t pt-3 space-y-2">
                  {key === "recurring" && (
                    <div className="flex gap-1 flex-wrap items-center">
                      <span className="text-[10px] text-muted-foreground mr-1">Jours:</span>
                      {DAY_LABELS.map((lbl, dow) => (
                        <button
                          key={dow}
                          onClick={() => setNewHabitDays((p) => p.includes(dow) ? p.filter((d) => d !== dow) : [...p, dow].sort())}
                          className={cn(
                            "h-6 w-6 rounded text-[10px] font-bold border transition-colors",
                            newHabitDays.includes(dow) ? "text-white" : "bg-background text-muted-foreground hover:bg-muted"
                          )}
                          style={newHabitDays.includes(dow) ? { backgroundColor: bar, borderColor: bar } : undefined}
                        >{lbl}</button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-1.5">
                    <Input
                      placeholder={`+ Nouvelle ${label.toLowerCase()}...`}
                      value={newHabitText[key]}
                      onChange={(e) => setNewHabitText((p) => ({ ...p, [key]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && addHabit(key)}
                      className="h-8 text-xs"
                    />
                    <Button size="sm" className="h-8 px-2.5 text-white" style={{ backgroundColor: bar }} onClick={() => addHabit(key)}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* === DASHBOARD MENSUEL DE TOUTES LES HABITUDES === */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-b">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              📊 Dashboard mensuel
              <span className="text-xs font-normal text-muted-foreground capitalize">— {format(monthCursor, "MMMM yyyy", { locale: fr })}</span>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMonthCursor(subMonths(monthCursor, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setMonthCursor(startOfMonth(now))}>
                Ce mois
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMonthCursor(addMonths(monthCursor, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {dailyHabits.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucune habitude. Ajoute-en ci-dessus pour commencer.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="border border-border/50 px-2 py-2 text-xs font-bold text-left sticky left-0 bg-background z-10 min-w-[160px]">Habitude</th>
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
                  {GROUPS.flatMap(({ key, label, color, bar }) => {
                    const items = groupedHabits[key];
                    if (items.length === 0) return [];
                    return [
                      <tr key={`hdr-${key}`}>
                        <td colSpan={monthDays.length + 2} className="px-2 py-1 text-[11px] font-black uppercase tracking-wider sticky left-0 z-10" style={{ backgroundColor: `${bar}15`, color }}>
                          {label}
                        </td>
                      </tr>,
                      ...items.map((h) => {
                        const validDays = monthDays.filter((d) => d <= now && (key !== "recurring" || habitVisibleOnDate(h, format(d, "yyyy-MM-dd"))));
                        const completed = validDays.filter((d) => isHabitCompleted(h.id, format(d, "yyyy-MM-dd"))).length;
                        const pct = validDays.length > 0 ? Math.round((completed / validDays.length) * 100) : 0;
                        return (
                          <tr key={h.id} className="hover:bg-muted/30">
                            <td className="border border-border/50 px-2 py-1 text-xs font-medium sticky left-0 bg-background z-10 whitespace-nowrap">{h.title}</td>
                            {monthDays.map((d) => {
                              const ds = format(d, "yyyy-MM-dd");
                              const visible = key !== "recurring" || habitVisibleOnDate(h, ds);
                              const done = isHabitCompleted(h.id, ds);
                              const isFuture = d > now;
                              return (
                                <td key={ds} className={cn("border border-border/50 text-center p-0", isSameDay(d, now) && "bg-primary/5")}>
                                  {!visible ? (
                                    <div className="w-full h-7 bg-muted/20" />
                                  ) : (
                                    <button
                                      disabled={isFuture}
                                      onClick={() => toggleHabitLog(h.id, ds)}
                                      className={cn(
                                        "w-full h-7 text-xs font-bold transition-colors",
                                        isFuture ? "text-muted-foreground/30 cursor-not-allowed" :
                                        done ? "text-white" : "hover:bg-muted/50 text-muted-foreground"
                                      )}
                                      style={done ? { backgroundColor: bar } : undefined}
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
                      })
                    ];
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
