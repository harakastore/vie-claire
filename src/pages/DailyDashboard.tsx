import { useEffect, useMemo, useState } from "react";
import { format, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Sun, Star, Rocket, Shield, Dumbbell, Utensils, Flame,
  TrendingDown, TrendingUp, ArrowRight, ListTodo, Coffee, Sandwich, Apple, Moon, CalendarDays
} from "lucide-react";

const BLOCKS = [
  { key: "day_priority", label: "⭐ Priorités", color: "hsl(45, 90%, 50%)" },
  { key: "fajr_dhuhr", label: "Fajr → Dhuhr", color: "hsl(200, 60%, 50%)" },
  { key: "dhuhr_asr", label: "Dhuhr → Asr", color: "hsl(40, 70%, 50%)" },
  { key: "asr_maghrib", label: "Asr → Maghrib", color: "hsl(25, 70%, 55%)" },
  { key: "maghrib_isha", label: "Maghrib → Isha", color: "hsl(260, 50%, 55%)" },
  { key: "isha_fajr", label: "Isha → Fajr", color: "hsl(230, 45%, 40%)" },
];

const MEAL_TYPES = [
  { key: "petit_dej", label: "Petit-déj", icon: Coffee, color: "hsl(35, 85%, 55%)" },
  { key: "dej", label: "Déjeuner", icon: Sandwich, color: "hsl(15, 80%, 55%)" },
  { key: "collation", label: "Collation", icon: Apple, color: "hsl(150, 60%, 45%)" },
  { key: "diner", label: "Dîner", icon: Moon, color: "hsl(250, 55%, 55%)" },
];

const BASAL_KCAL = 2000;

const habitVisibleOnDate = (h: any, dateStr: string) => {
  const days = h.days_of_week as number[] | null | undefined;
  if (!days || days.length === 0) return true;
  const dow = new Date(dateStr + "T00:00:00").getDay();
  return days.includes(dow);
};

export default function DailyDashboard() {
  const { user } = useAuth();
  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const wsStr = format(weekStart, "yyyy-MM-dd");
  const dayIndex = (now.getDay() + 6) % 7; // Mon=0

  const [tasks, setTasks] = useState<any[]>([]);
  const [habits, setHabits] = useState<any[]>([]);
  const [habitLogs, setHabitLogs] = useState<any[]>([]);
  const [sport, setSport] = useState<any>(null);
  const [meals, setMeals] = useState<any[]>([]);
  const [mealItems, setMealItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    if (!user) return;
    setLoading(true);
    const [t, h, hl, s, m] = await Promise.all([
      (supabase.from("daily_tasks" as any) as any).select("*").eq("day_date", todayStr).order("created_at"),
      (supabase.from("daily_habits" as any) as any).select("*").eq("active", true).order("sort_order"),
      (supabase.from("daily_habit_logs" as any) as any).select("*").eq("day_date", todayStr),
      (supabase.from("weekly_sports" as any) as any).select("*").eq("week_start", wsStr).eq("day_index", dayIndex).maybeSingle(),
      (supabase.from("meals" as any) as any).select("*").eq("day_date", todayStr),
    ]);
    setTasks(t.data || []);
    setHabits(h.data || []);
    setHabitLogs(hl.data || []);
    setSport(s.data || null);
    const mealsData = m.data || [];
    setMeals(mealsData);
    if (mealsData.length > 0) {
      const ids = mealsData.map((x: any) => x.id);
      const items = await (supabase.from("meal_items" as any) as any).select("*").in("meal_id", ids);
      setMealItems(items.data || []);
    } else setMealItems([]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [user, todayStr]);

  const toggleTask = async (t: any) => {
    const nv = !t.completed;
    setTasks((p) => p.map((x) => x.id === t.id ? { ...x, completed: nv } : x));
    await (supabase.from("daily_tasks" as any) as any).update({ completed: nv }).eq("id", t.id);
  };

  const isHabitDone = (habitId: string) => habitLogs.some((l: any) => l.habit_id === habitId && l.completed);

  const toggleHabit = async (habitId: string) => {
    if (!user) return;
    const existing = habitLogs.find((l: any) => l.habit_id === habitId);
    if (existing) {
      const nv = !existing.completed;
      setHabitLogs((p) => p.map((l) => l.id === existing.id ? { ...l, completed: nv } : l));
      await (supabase.from("daily_habit_logs" as any) as any).update({ completed: nv }).eq("id", existing.id);
    } else {
      const tmp = `temp-${Date.now()}`;
      setHabitLogs((p) => [...p, { id: tmp, user_id: user.id, habit_id: habitId, day_date: todayStr, completed: true }]);
      const { data } = await (supabase.from("daily_habit_logs" as any) as any)
        .insert({ user_id: user.id, habit_id: habitId, day_date: todayStr, completed: true }).select().single();
      if (data) setHabitLogs((p) => p.map((l) => l.id === tmp ? data : l));
    }
  };

  const toggleMealCompleted = async (mealId: string, completed: boolean) => {
    setMeals((p) => p.map((m) => m.id === mealId ? { ...m, completed: !completed } : m));
    await (supabase.from("meals" as any) as any).update({ completed: !completed }).eq("id", mealId);
  };

  const personalHabits = useMemo(() => habits.filter((h: any) => {
    const c = h.category || "personal";
    return (c === "personal" || c === "recurring") && habitVisibleOnDate(h, todayStr);
  }), [habits, todayStr]);
  const businessHabits = useMemo(() => habits.filter((h: any) => h.category === "business"), [habits]);

  const tasksDone = tasks.filter((t) => t.completed).length;
  const tasksPct = tasks.length > 0 ? Math.round((tasksDone / tasks.length) * 100) : 0;

  // Nutrition totals — only from checked (completed) meals
  const nutrition = useMemo(() => {
    let kcal = 0, protein = 0;
    meals.forEach((m: any) => {
      if (!m.completed) return;
      mealItems.filter((it: any) => it.meal_id === m.id).forEach((it: any) => {
        kcal += Number(it.kcal || 0);
        protein += Number(it.protein_g || 0);
      });
    });
    return { kcal: Math.round(kcal), protein: Math.round(protein) };
  }, [meals, mealItems]);

  const kcalBurned = Number(sport?.kcal_burned || 0);
  const netCal = nutrition.kcal - BASAL_KCAL - kcalBurned;
  const isDeficit = netCal < 0;

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <PageHeader title="🌞 Dashboard du jour" />
        <div className="grid gap-4 md:grid-cols-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Hero */}
      <div className="rounded-2xl p-5 shadow-lg text-white relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, hsl(220, 70%, 45%), hsl(280, 65%, 50%))" }}>
        <div className="absolute -top-8 -right-8 opacity-10"><Sun className="h-40 w-40" /></div>
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2">
              <Sun className="h-7 w-7" /> Dashboard du jour
            </h1>
            <p className="text-sm opacity-90 mt-1 capitalize">{format(now, "EEEE d MMMM yyyy", { locale: fr })}</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <StatMini label="Tâches" value={`${tasksDone}/${tasks.length}`} sub={`${tasksPct}%`} />
            <StatMini label="Discipline" value={`${personalHabits.filter(h => isHabitDone(h.id)).length}/${personalHabits.length}`} />
            <StatMini label="Business" value={`${businessHabits.filter(h => isHabitDone(h.id)).length}/${businessHabits.length}`} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Tasks */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20 border-b">
            <CardTitle className="text-base font-bold flex items-center justify-between gap-2">
              <span className="flex items-center gap-2"><ListTodo className="h-4 w-4 text-blue-600" /> Vue quotidienne — {tasksDone}/{tasks.length}</span>
              <Link to="/objectifs"><Button size="sm" variant="ghost" className="h-7 text-xs">Gérer <ArrowRight className="h-3 w-3 ml-1" /></Button></Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3 space-y-3 max-h-[500px] overflow-auto">
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Aucune tâche pour aujourd'hui. <Link className="text-primary underline" to="/objectifs">En ajouter</Link></p>
            ) : BLOCKS.map((b) => {
              const list = tasks.filter((t) => (t.block || "fajr_dhuhr") === b.key);
              if (list.length === 0) return null;
              return (
                <div key={b.key} className="rounded-lg border" style={{ borderColor: `${b.color}40` }}>
                  <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide" style={{ backgroundColor: `${b.color}15`, color: b.color }}>{b.label}</div>
                  <div className="px-3 py-2 space-y-1">
                    {list.map((t: any) => (
                      <label key={t.id} className={cn("flex items-start gap-2 py-1 cursor-pointer rounded px-1", t.completed && "bg-emerald-50 dark:bg-emerald-950/30")}>
                        <Checkbox checked={t.completed} onCheckedChange={() => toggleTask(t)} className="h-4 w-4 mt-0.5" />
                        <span className={cn("text-sm flex-1", t.completed && "line-through text-muted-foreground")}>{t.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Discipline */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-3 bg-gradient-to-r from-sky-50 to-purple-50 dark:from-sky-950/30 dark:to-purple-950/20 border-b">
            <CardTitle className="text-base font-bold flex items-center justify-between gap-2">
              <span className="flex items-center gap-2"><Shield className="h-4 w-4 text-sky-600" /> Discipline du jour</span>
              <Link to="/discipline"><Button size="sm" variant="ghost" className="h-7 text-xs">Gérer <ArrowRight className="h-3 w-3 ml-1" /></Button></Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3 space-y-1.5 max-h-[500px] overflow-auto">
            {personalHabits.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Aucune habitude pour aujourd'hui</p>
            ) : personalHabits.map((h: any) => {
              const done = isHabitDone(h.id);
              const isRecurring = h.category === "recurring";
              return (
                <label key={h.id} className={cn("flex items-start gap-2 py-1.5 px-2 rounded cursor-pointer", done && "bg-emerald-50 dark:bg-emerald-950/30")}>
                  <Checkbox checked={done} onCheckedChange={() => toggleHabit(h.id)} className="h-4 w-4 mt-0.5" />
                  {isRecurring && <CalendarDays className="h-3.5 w-3.5 text-purple-500 mt-0.5" />}
                  <span className={cn("text-sm flex-1 font-medium", done && "line-through text-muted-foreground")}>{h.title}</span>
                </label>
              );
            })}
          </CardContent>
        </Card>

        {/* Business Routine */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-3 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/20 border-b">
            <CardTitle className="text-base font-bold flex items-center justify-between gap-2">
              <span className="flex items-center gap-2"><Rocket className="h-4 w-4 text-orange-600" /> Business Daily Routine</span>
              <Link to="/business-routine"><Button size="sm" variant="ghost" className="h-7 text-xs">Gérer <ArrowRight className="h-3 w-3 ml-1" /></Button></Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3 space-y-1.5 max-h-[500px] overflow-auto">
            {businessHabits.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Aucune routine. <Link className="text-primary underline" to="/business-routine">En créer</Link></p>
            ) : businessHabits.map((h: any) => {
              const done = isHabitDone(h.id);
              return (
                <label key={h.id} className={cn("flex items-start gap-2 py-1.5 px-2 rounded cursor-pointer", done && "bg-emerald-50 dark:bg-emerald-950/30")}>
                  <Checkbox checked={done} onCheckedChange={() => toggleHabit(h.id)} className="h-4 w-4 mt-0.5" />
                  <span className={cn("text-sm flex-1 font-medium", done && "line-through text-muted-foreground")}>{h.title}</span>
                </label>
              );
            })}
          </CardContent>
        </Card>

        {/* Sport & Nutrition */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-3 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20 border-b">
            <CardTitle className="text-base font-bold flex items-center justify-between gap-2">
              <span className="flex items-center gap-2"><Dumbbell className="h-4 w-4 text-emerald-600" /> Sport & Nutrition</span>
              <Link to="/sport"><Button size="sm" variant="ghost" className="h-7 text-xs">Gérer <ArrowRight className="h-3 w-3 ml-1" /></Button></Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3 space-y-3 max-h-[500px] overflow-auto">
            <div className="rounded-lg border bg-emerald-50/40 dark:bg-emerald-950/20 p-3">
              <p className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 mb-1">Programme sport</p>
              <p className="text-sm font-medium">{sport?.program || <span className="text-muted-foreground italic">Pas de programme défini</span>}</p>
              {sport?.sport_time && <p className="text-xs text-muted-foreground mt-1">🕐 {sport.sport_time}</p>}
              {sport && (
                <div className="mt-2 flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1"><Flame className="h-3 w-3 text-orange-500" /> <b>{kcalBurned}</b> kcal brûlées</span>
                  {sport.completed && <span className="text-emerald-600 font-bold">✓ Fait</span>}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border p-2.5 text-center">
                <p className="text-[10px] uppercase text-muted-foreground">Kcal mangées</p>
                <p className="text-xl font-black tabular-nums text-emerald-600">{nutrition.kcal}</p>
              </div>
              <div className="rounded-lg border p-2.5 text-center">
                <p className="text-[10px] uppercase text-muted-foreground">Protéines</p>
                <p className="text-xl font-black tabular-nums text-indigo-600">{nutrition.protein}g</p>
              </div>
            </div>

            <div className={cn("rounded-lg p-3 text-center border-2", isDeficit ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30" : "border-red-400 bg-red-50 dark:bg-red-950/30")}>
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Bilan calorique (base {BASAL_KCAL} + sport)</p>
              <p className={cn("text-2xl font-black tabular-nums flex items-center justify-center gap-1", isDeficit ? "text-emerald-700" : "text-red-700")}>
                {isDeficit ? <TrendingDown className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />}
                {netCal > 0 ? "+" : ""}{netCal} kcal
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{isDeficit ? "🎯 Déficit — objectif atteint" : "⚠️ Surplus calorique"}</p>
            </div>

            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Utensils className="h-3 w-3" /> Repas du jour</p>
              {MEAL_TYPES.map((mt) => {
                const meal = meals.find((m: any) => m.meal_type === mt.key);
                const items = meal ? mealItems.filter((it: any) => it.meal_id === meal.id) : [];
                const totalK = items.reduce((s, it) => s + Number(it.kcal || 0), 0);
                const totalP = items.reduce((s, it) => s + Number(it.protein_g || 0), 0);
                const Icon = mt.icon;
                const done = !!meal?.completed;
                return (
                  <div key={mt.key} className={cn("flex items-center gap-2 rounded border px-2 py-1.5", done && "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300")}>
                    <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: mt.color }} />
                    <span className="text-xs font-semibold flex-1">{mt.label}</span>
                    <span className="text-[11px] tabular-nums text-muted-foreground">{Math.round(totalK)} kcal · {Math.round(totalP)}g</span>
                    {meal && (
                      <Checkbox checked={done} onCheckedChange={() => toggleMealCompleted(meal.id, done)} className="h-4 w-4" />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatMini({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white/15 backdrop-blur rounded-lg px-3 py-1.5 text-center min-w-[80px]">
      <p className="text-[9px] uppercase tracking-wider opacity-80 font-semibold">{label}</p>
      <p className="text-sm font-black tabular-nums">{value}{sub && <span className="text-[10px] opacity-70 ml-1">{sub}</span>}</p>
    </div>
  );
}
