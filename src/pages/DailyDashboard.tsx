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
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Sun, Star, Rocket, Shield, Dumbbell, Utensils, Flame, Plus, Trash2,
  TrendingDown, TrendingUp, ArrowRight, ListTodo, Coffee, Sandwich, Apple, Moon, CalendarDays, Trophy
} from "lucide-react";

const BLOCKS = [
  { key: "day_priority", label: "⭐ Priorités du jour", color: "hsl(45, 90%, 50%)" },
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
const FAJR_KEYWORDS = ["fajr", "al fajr", "alfajr", "الفجر"];
const isFajrHabit = (h: any) => {
  const t = (h.title || "").toLowerCase().trim();
  return FAJR_KEYWORDS.some((k) => t.includes(k));
};

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
  const dayIndex = (now.getDay() + 6) % 7;

  const [tasks, setTasks] = useState<any[]>([]);
  const [habits, setHabits] = useState<any[]>([]);
  const [habitLogs, setHabitLogs] = useState<any[]>([]);
  const [sport, setSport] = useState<any>(null);
  const [meals, setMeals] = useState<any[]>([]);
  const [mealItems, setMealItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick add kcal
  const [qMealType, setQMealType] = useState<string>("petit_dej");
  const [qName, setQName] = useState("");
  const [qKcal, setQKcal] = useState("");
  const [qProtein, setQProtein] = useState("");

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

  const addQuickMealItem = async () => {
    if (!user || !qName.trim()) return;
    let meal = meals.find((m: any) => m.meal_type === qMealType);
    if (!meal) {
      const { data } = await (supabase.from("meals" as any) as any)
        .insert({ user_id: user.id, day_date: todayStr, meal_type: qMealType, completed: true }).select().single();
      if (!data) return;
      meal = data;
      setMeals((p) => [...p, data]);
    } else if (!meal.completed) {
      // auto-mark completed so kcal count in
      await (supabase.from("meals" as any) as any).update({ completed: true }).eq("id", meal.id);
      setMeals((p) => p.map((m) => m.id === meal!.id ? { ...m, completed: true } : m));
    }
    const item = {
      user_id: user.id, meal_id: meal.id, name: qName.trim(),
      kcal: Number(qKcal || 0), protein_g: Number(qProtein || 0),
    };
    const { data: itemData } = await (supabase.from("meal_items" as any) as any).insert(item).select().single();
    if (itemData) setMealItems((p) => [...p, itemData]);
    setQName(""); setQKcal(""); setQProtein("");
  };

  const deleteMealItem = async (id: string) => {
    setMealItems((p) => p.filter((it) => it.id !== id));
    await (supabase.from("meal_items" as any) as any).delete().eq("id", id);
  };

  const personalHabits = useMemo(() => habits.filter((h: any) => {
    const c = h.category || "personal";
    return (c === "personal" || c === "recurring") && !isFajrHabit(h) && habitVisibleOnDate(h, todayStr);
  }), [habits, todayStr]);
  const businessHabits = useMemo(() => habits.filter((h: any) =>
    h.category === "business" && habitVisibleOnDate(h, todayStr)
  ), [habits, todayStr]);
  const fajrHabits = useMemo(() => habits.filter(isFajrHabit), [habits]);
  const fajrDone = fajrHabits.length > 0 && fajrHabits.every((h) => isHabitDone(h.id));

  const tasksDone = tasks.filter((t) => t.completed).length;
  const tasksPct = tasks.length > 0 ? Math.round((tasksDone / tasks.length) * 100) : 0;

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
      <div className="space-y-6 max-w-5xl mx-auto">
        <PageHeader title="🌞 Dashboard du jour" />
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatMini label="Tâches" value={`${tasksDone}/${tasks.length}`} sub={`${tasksPct}%`} />
            <StatMini label="Discipline" value={`${personalHabits.filter(h => isHabitDone(h.id)).length}/${personalHabits.length}`} />
            <StatMini label="Business" value={`${businessHabits.filter(h => isHabitDone(h.id)).length}/${businessHabits.length}`} />
            <StatMini label="Fajr" value={fajrDone ? "✓" : (fajrHabits.length > 0 ? "—" : "—")} />
          </div>
        </div>
      </div>

      {/* === VUE QUOTIDIENNE — même design que Goals === */}
      <Card className="overflow-hidden border-2 border-primary/30 shadow-lg">
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-secondary opacity-95" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.25),_transparent_60%)]" />
          <div className="relative px-5 py-4 text-primary-foreground flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <ListTodo className="h-5 w-5" />
              <div>
                <h2 className="text-lg font-black tracking-tight">Vue quotidienne — Time-blocking</h2>
                <p className="text-xs opacity-80">{tasksDone}/{tasks.length} tâches · {tasksPct}%</p>
              </div>
            </div>
            <Link to="/objectifs">
              <Button size="sm" variant="ghost" className="h-8 text-primary-foreground hover:bg-white/20 border border-white/30">
                Gérer <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
        <CardContent className="p-4 space-y-3 bg-gradient-to-b from-muted/30 to-transparent">
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucune tâche aujourd'hui. <Link className="text-primary underline" to="/objectifs">En ajouter →</Link>
            </p>
          ) : BLOCKS.map((b) => {
            const list = tasks.filter((t) => (t.block || "fajr_dhuhr") === b.key);
            if (list.length === 0) return null;
            const done = list.filter((t) => t.completed).length;
            return (
              <div key={b.key} className="rounded-xl border-2 bg-card overflow-hidden shadow-sm"
                style={{ borderTopColor: b.color, borderTopWidth: "4px" }}>
                <div className="px-3 py-2 flex items-center justify-between" style={{ backgroundColor: `${b.color}12` }}>
                  <span className="text-xs font-black uppercase tracking-wide" style={{ color: b.color }}>{b.label}</span>
                  <span className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full bg-white dark:bg-black/30" style={{ color: b.color }}>
                    {done}/{list.length}
                  </span>
                </div>
                <div className="px-3 py-2 space-y-1">
                  {list.map((t: any) => (
                    <label key={t.id} className={cn("flex items-start gap-2 py-1 px-1.5 rounded cursor-pointer transition-colors",
                      t.completed ? "bg-emerald-50 dark:bg-emerald-950/30" : "hover:bg-muted/60")}>
                      <Checkbox checked={t.completed} onCheckedChange={() => toggleTask(t)} className="h-4 w-4 mt-0.5" />
                      <span className={cn("text-sm flex-1 font-medium", t.completed && "line-through text-muted-foreground")}>{t.title}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* === DISCIPLINE TASKS === */}
      <SectionCard
        icon={<Shield className="h-4 w-4" />}
        title="Discipline du jour"
        subtitle={`${personalHabits.filter(h => isHabitDone(h.id)).length}/${personalHabits.length} complétées`}
        gradient="from-sky-500 to-purple-500"
        manageLink="/discipline"
      >
        {personalHabits.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Aucune habitude pour aujourd'hui</p>
        ) : (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {personalHabits.map((h: any) => {
              const done = isHabitDone(h.id);
              const isRec = h.category === "recurring";
              return (
                <label key={h.id} className={cn("flex items-start gap-2 py-2 px-3 rounded-lg cursor-pointer border transition-all",
                  done ? "bg-emerald-50 border-emerald-300 dark:bg-emerald-950/30" : "bg-card hover:bg-muted/60 border-border/40")}>
                  <Checkbox checked={done} onCheckedChange={() => toggleHabit(h.id)} className="h-4 w-4 mt-0.5" />
                  {isRec && <CalendarDays className="h-3.5 w-3.5 text-purple-500 mt-0.5" />}
                  <span className={cn("text-sm flex-1 font-medium", done && "line-through text-muted-foreground")}>{h.title}</span>
                </label>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* === BUSINESS ROUTINE === */}
      <SectionCard
        icon={<Rocket className="h-4 w-4" />}
        title="Business Daily Routine"
        subtitle={`${businessHabits.filter(h => isHabitDone(h.id)).length}/${businessHabits.length} complétées`}
        gradient="from-orange-500 to-amber-500"
        manageLink="/business-routine"
      >
        {businessHabits.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Aucune routine. <Link className="text-primary underline" to="/business-routine">En créer →</Link>
          </p>
        ) : (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {businessHabits.map((h: any) => {
              const done = isHabitDone(h.id);
              return (
                <label key={h.id} className={cn("flex items-start gap-2 py-2 px-3 rounded-lg cursor-pointer border transition-all",
                  done ? "bg-emerald-50 border-emerald-300 dark:bg-emerald-950/30" : "bg-card hover:bg-muted/60 border-border/40")}>
                  <Checkbox checked={done} onCheckedChange={() => toggleHabit(h.id)} className="h-4 w-4 mt-0.5" />
                  <span className={cn("text-sm flex-1 font-medium", done && "line-through text-muted-foreground")}>{h.title}</span>
                </label>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* === SALAT AL FAJR === */}
      <Card className="overflow-hidden border-2" style={{ borderColor: "hsl(48, 95%, 60%)" }}>
        <CardHeader className="pb-3" style={{ background: "linear-gradient(135deg, hsl(48, 100%, 60%), hsl(35, 95%, 55%))" }}>
          <CardTitle className="text-base font-black flex items-center justify-between text-white">
            <span className="flex items-center gap-2">🕌 Salat Al Fajr</span>
            <Link to="/discipline"><Button size="sm" variant="ghost" className="h-7 text-white hover:bg-white/20 text-xs">Gérer <ArrowRight className="h-3 w-3 ml-1" /></Button></Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4" style={{ backgroundColor: "hsl(48, 100%, 98%)" }}>
          {fajrHabits.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucune habitude « Fajr » détectée. <Link className="text-primary underline" to="/discipline">Créer →</Link>
            </p>
          ) : (
            <div className="space-y-2">
              {fajrHabits.map((h: any) => {
                const done = isHabitDone(h.id);
                return (
                  <label key={h.id} className={cn("flex items-center gap-3 py-3 px-4 rounded-lg cursor-pointer border-2 transition-all",
                    done ? "bg-emerald-100 border-emerald-400 dark:bg-emerald-950/30" : "bg-white border-amber-300 hover:border-amber-500")}>
                    <Checkbox checked={done} onCheckedChange={() => toggleHabit(h.id)} className="h-5 w-5" />
                    <span className={cn("text-base flex-1 font-bold", done ? "text-emerald-700 line-through" : "text-amber-900")}>{h.title}</span>
                    {done && <Trophy className="h-5 w-5 text-emerald-500" />}
                  </label>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* === SPORT & NUTRITION === */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
          <CardTitle className="text-base font-black flex items-center justify-between">
            <span className="flex items-center gap-2"><Dumbbell className="h-4 w-4" /> Sport & Nutrition</span>
            <Link to="/sport"><Button size="sm" variant="ghost" className="h-7 text-white hover:bg-white/20 text-xs">Gérer <ArrowRight className="h-3 w-3 ml-1" /></Button></Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="rounded-lg border-2 bg-emerald-50/40 dark:bg-emerald-950/20 p-3 border-emerald-300/60">
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

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border p-3 text-center">
              <p className="text-[10px] uppercase text-muted-foreground">Kcal mangées</p>
              <p className="text-xl font-black tabular-nums text-emerald-600">{nutrition.kcal}</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-[10px] uppercase text-muted-foreground">Protéines</p>
              <p className="text-xl font-black tabular-nums text-indigo-600">{nutrition.protein}g</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-[10px] uppercase text-muted-foreground">Kcal brûlées</p>
              <p className="text-xl font-black tabular-nums text-orange-600">{kcalBurned}</p>
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

          {/* Quick add kcal */}
          <div className="rounded-lg border-2 border-dashed border-emerald-300 p-3 bg-emerald-50/40 dark:bg-emerald-950/10 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
              <Plus className="h-3 w-3" /> Ajouter kcal rapidement
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <select value={qMealType} onChange={(e) => setQMealType(e.target.value)}
                className="h-8 text-xs rounded-md border border-input bg-background px-2 col-span-2 sm:col-span-1">
                {MEAL_TYPES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
              <Input placeholder="Nom (ex: 3 œufs)" value={qName} onChange={(e) => setQName(e.target.value)}
                className="h-8 text-xs col-span-2" />
              <Input placeholder="kcal" type="number" value={qKcal} onChange={(e) => setQKcal(e.target.value)} className="h-8 text-xs" />
              <Input placeholder="protéines (g)" type="number" value={qProtein} onChange={(e) => setQProtein(e.target.value)} className="h-8 text-xs" />
            </div>
            <Button size="sm" className="h-8 w-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={addQuickMealItem} disabled={!qName.trim()}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter au repas
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Utensils className="h-3 w-3" /> Repas du jour</p>
            {MEAL_TYPES.map((mt) => {
              const meal = meals.find((m: any) => m.meal_type === mt.key);
              const items = meal ? mealItems.filter((it: any) => it.meal_id === meal.id) : [];
              const totalK = items.reduce((s, it) => s + Number(it.kcal || 0), 0);
              const totalP = items.reduce((s, it) => s + Number(it.protein_g || 0), 0);
              const Icon = mt.icon;
              const done = !!meal?.completed;
              return (
                <div key={mt.key} className={cn("rounded-lg border-2 p-2", done ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300" : "border-border/50")}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0" style={{ color: mt.color }} />
                    <span className="text-sm font-bold flex-1">{mt.label}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">{Math.round(totalK)} kcal · {Math.round(totalP)}g</span>
                    {meal && (
                      <Checkbox checked={done} onCheckedChange={() => toggleMealCompleted(meal.id, done)} className="h-4 w-4" />
                    )}
                  </div>
                  {items.length > 0 && (
                    <ul className="mt-1.5 pl-6 space-y-0.5">
                      {items.map((it: any) => (
                        <li key={it.id} className="text-[11px] text-muted-foreground flex items-center gap-2 group">
                          <span className="flex-1">• {it.name} <span className="tabular-nums">({Math.round(it.kcal)}k · {Math.round(it.protein_g)}g)</span></span>
                          <button onClick={() => deleteMealItem(it.id)} className="opacity-0 group-hover:opacity-100 text-destructive">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
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

function SectionCard({ icon, title, subtitle, gradient, manageLink, children }: {
  icon: React.ReactNode; title: string; subtitle?: string; gradient: string; manageLink?: string; children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className={cn("pb-3 text-white bg-gradient-to-r", gradient)}>
        <CardTitle className="text-base font-black flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">{icon} {title}
            {subtitle && <span className="text-xs font-normal opacity-90">— {subtitle}</span>}
          </span>
          {manageLink && (
            <Link to={manageLink}><Button size="sm" variant="ghost" className="h-7 text-white hover:bg-white/20 text-xs">Gérer <ArrowRight className="h-3 w-3 ml-1" /></Button></Link>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">{children}</CardContent>
    </Card>
  );
}
