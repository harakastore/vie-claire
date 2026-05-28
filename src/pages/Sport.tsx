import { useEffect, useMemo, useState } from "react";
import { format, startOfWeek, addDays, isSameDay, subWeeks, differenceInCalendarDays, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  CheckSquare, ChevronLeft, ChevronRight, Dumbbell, Flame,
  TrendingDown, TrendingUp, Copy, Utensils, Clock, Plus, Trash2,
  Target, Scale, Trophy, Coffee, Sandwich, Apple, Moon
} from "lucide-react";
import heroPhoto from "@/assets/discipline-hero.png";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const DAY_NAMES = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const BASAL_KCAL = 2000;

const MEAL_TYPES = [
  { key: "petit_dej", label: "Petit-déj", icon: Coffee, color: "hsl(35, 85%, 55%)" },
  { key: "dej", label: "Déjeuner", icon: Sandwich, color: "hsl(15, 80%, 55%)" },
  { key: "collation", label: "Collation", icon: Apple, color: "hsl(150, 60%, 45%)" },
  { key: "diner", label: "Dîner", icon: Moon, color: "hsl(250, 55%, 55%)" },
];

export default function Sport() {
  const { user } = useAuth();
  const now = new Date();
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(now, { weekStartsOn: 1 }));
  const wsStr = format(weekStart, "yyyy-MM-dd");
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const [weeklySports, setWeeklySports] = useState<any[]>([]);
  const [meals, setMeals] = useState<any[]>([]);
  const [mealItems, setMealItems] = useState<any[]>([]);
  const [weightLogs, setWeightLogs] = useState<any[]>([]);
  const [weightGoal, setWeightGoal] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // New item draft per meal (free text + AI-parsed)
  const [newItem, setNewItem] = useState<Record<string, { name: string; kcal: string; protein: string }>>({});
  const [parsingKey, setParsingKey] = useState<string | null>(null);
  const [estimatingBurn, setEstimatingBurn] = useState<number | null>(null);
  const [todayWeight, setTodayWeight] = useState("");

  const fetchAll = async () => {
    if (!user) return;
    setLoading(true);
    const weekDates = weekDays.map(d => format(d, "yyyy-MM-dd"));
    const [sportsRes, mealsRes, weightsRes, goalRes] = await Promise.all([
      (supabase.from("weekly_sports" as any) as any).select("*").eq("week_start", wsStr),
      (supabase.from("meals" as any) as any).select("*").in("day_date", weekDates),
      (supabase.from("weight_logs" as any) as any).select("*").order("log_date", { ascending: false }).limit(60),
      (supabase.from("weight_goal" as any) as any).select("*").maybeSingle(),
    ]);
    setWeeklySports(sportsRes.data || []);
    const mealsData = mealsRes.data || [];
    setMeals(mealsData);
    if (mealsData.length > 0) {
      const ids = mealsData.map((m: any) => m.id);
      const itemsRes = await (supabase.from("meal_items" as any) as any).select("*").in("meal_id", ids);
      setMealItems(itemsRes.data || []);
    } else {
      setMealItems([]);
    }
    setWeightLogs(weightsRes.data || []);
    setWeightGoal(goalRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [user, wsStr]);

  // ===== SPORT =====
  const upsertSport = async (dayIndex: number, patch: any) => {
    if (!user) return;
    const existing = weeklySports.find((s: any) => s.day_index === dayIndex && s.id);
    if (existing) {
      await (supabase.from("weekly_sports" as any) as any).update(patch).eq("id", existing.id);
    } else {
      const payload: any = { user_id: user.id, week_start: wsStr, day_index: dayIndex, program: "", kcal_eaten: 0, kcal_burned: 0, completed: false, ...patch };
      const { data } = await (supabase.from("weekly_sports" as any) as any).insert(payload).select().single();
      if (data) setWeeklySports((prev) => {
        const idx = prev.findIndex(s => s.day_index === dayIndex);
        if (idx >= 0) { const u = [...prev]; u[idx] = data; return u; }
        return [...prev, data];
      });
    }
  };

  const updateLocalSport = (dayIndex: number, patch: any) => {
    setWeeklySports((prev) => {
      const idx = prev.findIndex((s: any) => s.day_index === dayIndex);
      if (idx >= 0) { const u = [...prev]; u[idx] = { ...u[idx], ...patch }; return u; }
      return [...prev, { day_index: dayIndex, program: "", completed: false, kcal_eaten: 0, kcal_burned: 0, ...patch }];
    });
  };

  const toggleCompleted = (dayIndex: number) => {
    const existing = weeklySports.find((s: any) => s.day_index === dayIndex);
    const newVal = !(existing?.completed);
    updateLocalSport(dayIndex, { completed: newVal });
    upsertSport(dayIndex, { completed: newVal });
  };

  const copyFromLastWeek = async () => {
    if (!user) return;
    const prevWs = format(subWeeks(weekStart, 1), "yyyy-MM-dd");
    const { data } = await (supabase.from("weekly_sports" as any) as any).select("*").eq("week_start", prevWs);
    if (!data || data.length === 0) {
      toast({ title: "Rien à copier", description: "Aucune donnée pour la semaine précédente." });
      return;
    }
    const rows = data.map((s: any) => ({
      user_id: user.id, week_start: wsStr, day_index: s.day_index,
      program: s.program || "", sport_time: s.sport_time, kcal_eaten: 0, kcal_burned: 0, completed: false,
    }));
    await (supabase.from("weekly_sports" as any) as any).delete().eq("user_id", user.id).eq("week_start", wsStr);
    await (supabase.from("weekly_sports" as any) as any).insert(rows);
    toast({ title: "Programme copié 📋", description: `${rows.length} jour(s) copié(s).` });
    fetchAll();
  };

  // ===== MEALS =====
  const ensureMeal = async (dateStr: string, mealType: string): Promise<string | null> => {
    if (!user) return null;
    const existing = meals.find((m: any) => m.day_date === dateStr && m.meal_type === mealType);
    if (existing) return existing.id;
    const { data } = await (supabase.from("meals" as any) as any)
      .insert({ user_id: user.id, day_date: dateStr, meal_type: mealType, completed: false })
      .select().single();
    if (data) {
      setMeals((prev) => [...prev, data]);
      return data.id;
    }
    return null;
  };

  const toggleMealCompleted = async (dateStr: string, mealType: string) => {
    const existing = meals.find((m: any) => m.day_date === dateStr && m.meal_type === mealType);
    if (!existing) return;
    const newVal = !existing.completed;
    setMeals((prev) => prev.map(m => m.id === existing.id ? { ...m, completed: newVal } : m));
    await (supabase.from("meals" as any) as any).update({ completed: newVal }).eq("id", existing.id);
  };

  const addMealItem = async (dateStr: string, mealType: string) => {
    if (!user) return;
    const draft = newItem[`${dateStr}-${mealType}`];
    if (!draft || !draft.name.trim()) return;
    const mealId = await ensureMeal(dateStr, mealType);
    if (!mealId) return;
    const payload = {
      user_id: user.id,
      meal_id: mealId,
      name: draft.name.trim(),
      kcal: parseFloat(draft.kcal) || 0,
      protein_g: parseFloat(draft.protein) || 0,
    };
    const { data } = await (supabase.from("meal_items" as any) as any).insert(payload).select().single();
    if (data) {
      setMealItems((prev) => [...prev, data]);
      setNewItem((prev) => ({ ...prev, [`${dateStr}-${mealType}`]: { name: "", kcal: "", protein: "" } }));
    }
  };

  const addMealItemSmart = async (dateStr: string, mealType: string) => {
    if (!user) return;
    const draftKey = `${dateStr}-${mealType}`;
    const draft = newItem[draftKey];
    if (!draft || !draft.name.trim()) return;
    setParsingKey(draftKey);
    try {
      const { data: parsed, error } = await supabase.functions.invoke("parse-meal", {
        body: { text: draft.name.trim() },
      });
      if (error || !parsed) {
        toast({ title: "Erreur", description: "Impossible d'analyser le repas", variant: "destructive" });
        return;
      }
      const mealId = await ensureMeal(dateStr, mealType);
      if (!mealId) return;
      const payload = {
        user_id: user.id,
        meal_id: mealId,
        name: parsed.name || draft.name.trim(),
        kcal: parsed.kcal || 0,
        protein_g: parsed.protein_g || 0,
      };
      const { data } = await (supabase.from("meal_items" as any) as any).insert(payload).select().single();
      if (data) {
        setMealItems((prev) => [...prev, data]);
        setNewItem((prev) => ({ ...prev, [draftKey]: { name: "", kcal: "", protein: "" } }));
        toast({ title: "✓ Ajouté", description: `${data.kcal} kcal · ${data.protein_g}g prot` });
      }
    } finally {
      setParsingKey(null);
    }
  };

  const deleteMealItem = async (id: string) => {
    setMealItems((prev) => prev.filter(i => i.id !== id));
    await (supabase.from("meal_items" as any) as any).delete().eq("id", id);
  };

  const estimateBurnedKcal = async (dayIndex: number) => {
    const sp = weeklySports.find(s => s.day_index === dayIndex);
    const program = sp?.program?.trim();
    if (!program) return;
    setEstimatingBurn(dayIndex);
    try {
      const { data, error } = await supabase.functions.invoke("parse-meal", {
        body: { text: program, type: "exercise" },
      });
      if (error || !data?.kcal_burned) {
        toast({ title: "Erreur", description: "Impossible d'estimer", variant: "destructive" });
        return;
      }
      updateLocalSport(dayIndex, { kcal_burned: data.kcal_burned });
      await upsertSport(dayIndex, { kcal_burned: data.kcal_burned });
      toast({ title: "🔥 Estimé", description: `${data.kcal_burned} kcal brûlées` });
    } finally {
      setEstimatingBurn(null);
    }
  };

  // ===== WEIGHT =====
  const logWeightToday = async () => {
    if (!user || !todayWeight) return;
    const w = parseFloat(todayWeight);
    if (isNaN(w)) return;
    const today = format(now, "yyyy-MM-dd");
    const { data } = await (supabase.from("weight_logs" as any) as any)
      .upsert({ user_id: user.id, log_date: today, weight_kg: w }, { onConflict: "user_id,log_date" })
      .select().single();
    if (data) {
      setWeightLogs((prev) => [data, ...prev.filter((l: any) => l.log_date !== today)]);
      setTodayWeight("");
      toast({ title: "Poids enregistré 💪", description: `${w} kg` });
    }
  };

  const saveGoal = async (start: number, target: number, targetDate: string) => {
    if (!user) return;
    const startDate = format(now, "yyyy-MM-dd");
    const { data } = await (supabase.from("weight_goal" as any) as any)
      .upsert({ user_id: user.id, start_weight_kg: start, target_weight_kg: target, start_date: startDate, target_date: targetDate }, { onConflict: "user_id" })
      .select().single();
    if (data) setWeightGoal(data);
  };

  // ===== AGGREGATES =====
  const dayMeals = (dateStr: string) => meals.filter((m: any) => m.day_date === dateStr);
  const mealItemsFor = (mealId: string) => mealItems.filter((i: any) => i.meal_id === mealId);
  const mealTotals = (mealId: string) => {
    const items = mealItemsFor(mealId);
    return {
      kcal: items.reduce((a, i) => a + Number(i.kcal || 0), 0),
      protein: items.reduce((a, i) => a + Number(i.protein_g || 0), 0),
    };
  };
  const dayMealTotals = (dateStr: string, onlyCompleted = true) => {
    const dms = dayMeals(dateStr).filter((m: any) => onlyCompleted ? m.completed : true);
    let kcal = 0, protein = 0;
    dms.forEach((m: any) => {
      const t = mealTotals(m.id);
      kcal += t.kcal; protein += t.protein;
    });
    return { kcal, protein };
  };

  const weeklyMealKcalEaten = useMemo(() => {
    return weekDays.reduce((acc, d) => acc + dayMealTotals(format(d, "yyyy-MM-dd"), true).kcal, 0);
  }, [meals, mealItems, weekDays]);

  const totalBurned = weeklySports.reduce((acc, s) => acc + (s.kcal_burned || 0), 0);
  const totalNet = weeklyMealKcalEaten - (BASAL_KCAL * 7) - totalBurned;
  const sportDays = weeklySports.filter((s) => s.completed).length;

  // Weight progression
  const currentWeight = weightLogs[0]?.weight_kg ? Number(weightLogs[0].weight_kg) : null;
  const goalProgress = useMemo(() => {
    if (!weightGoal || currentWeight === null) return null;
    const start = Number(weightGoal.start_weight_kg);
    const target = Number(weightGoal.target_weight_kg);
    const totalToLose = start - target;
    const lostSoFar = start - currentWeight;
    const pct = totalToLose !== 0 ? Math.max(0, Math.min(100, (lostSoFar / totalToLose) * 100)) : 0;
    const daysLeft = differenceInCalendarDays(parseISO(weightGoal.target_date), now);
    const remaining = currentWeight - target;
    return { start, target, current: currentWeight, lostSoFar, totalToLose, pct, daysLeft, remaining };
  }, [weightGoal, currentWeight]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Chargement…</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* HERO */}
      <div
        className="rounded-2xl p-5 shadow-xl text-white relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, hsl(220, 80%, 45%), hsl(190, 75%, 45%) 60%, hsl(160, 70%, 40%))" }}
      >
        <div className="absolute -top-8 -right-8 opacity-10"><Dumbbell className="h-44 w-44" /></div>
        <div className="relative flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-start gap-5">
            <img
              src={heroPhoto}
              alt="Objectif physique"
              className="h-32 w-32 sm:h-40 sm:w-40 rounded-2xl object-cover ring-4 ring-white/40 shadow-2xl shrink-0"
            />
            <div>
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur rounded-full px-3 py-1 text-xs font-bold mb-2">
                🏋️ SPORT & NUTRITION
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Programme hebdomadaire</h1>
              <p className="text-sm opacity-90 mt-1">Semaine du {format(weekStart, "d MMM", { locale: fr })} au {format(addDays(weekStart, 6), "d MMM yyyy", { locale: fr })}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 min-w-[300px]">
            <div className="bg-white/15 backdrop-blur rounded-xl p-3 text-center">
              <Dumbbell className="h-4 w-4 mx-auto mb-1" />
              <p className="text-xl font-black tabular-nums">{sportDays}/7</p>
              <p className="text-[10px] opacity-80 uppercase">Sessions</p>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-xl p-3 text-center">
              <Utensils className="h-4 w-4 mx-auto mb-1" />
              <p className="text-xl font-black tabular-nums">{Math.round(weeklyMealKcalEaten)}</p>
              <p className="text-[10px] opacity-80 uppercase">Kcal mangé</p>
            </div>
            <div className={cn(
              "rounded-xl p-3 text-center backdrop-blur",
              totalNet < 0 ? "bg-green-400/30" : totalNet > 1000 ? "bg-red-400/40" : "bg-white/15"
            )}>
              {totalNet < 0 ? <TrendingDown className="h-4 w-4 mx-auto mb-1" /> : <TrendingUp className="h-4 w-4 mx-auto mb-1" />}
              <p className="text-xl font-black tabular-nums">{totalNet > 0 ? "+" : ""}{Math.round(totalNet)}</p>
              <p className="text-[10px] opacity-80 uppercase">Net semaine</p>
            </div>
          </div>
        </div>
      </div>

      {/* PROGRAMME DU JOUR */}
      {(() => {
        const todayIdx = weekDays.findIndex(d => isSameDay(d, now));
        if (todayIdx < 0) return null;
        const sp = weeklySports.find((s: any) => s.day_index === todayIdx);
        const program = sp?.program?.trim();
        const kcalBurned = sp?.kcal_burned || 0;
        const dateStr = format(weekDays[todayIdx], "yyyy-MM-dd");
        const tot = dayMealTotals(dateStr, true);
        return (
          <Card className="border-2 border-primary/40 shadow-lg">
            <CardHeader className="py-3 px-4 bg-gradient-to-r from-primary/10 to-transparent">
              <CardTitle className="text-base flex items-center gap-2">
                <Flame className="h-4 w-4 text-primary" />
                Programme d'aujourd'hui — {format(now, "EEEE d MMMM", { locale: fr })}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {program ? (
                <div className="flex items-start gap-2">
                  <Dumbbell className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <p className="text-sm whitespace-pre-wrap">{program}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Aucun programme défini pour aujourd'hui.</p>
              )}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                <div className="text-center">
                  <p className="text-lg font-black tabular-nums">{Math.round(tot.kcal)}</p>
                  <p className="text-[10px] uppercase text-muted-foreground">Kcal mangé</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-black tabular-nums">{Math.round(tot.protein)}g</p>
                  <p className="text-[10px] uppercase text-muted-foreground">Protéines</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-black tabular-nums">{kcalBurned}</p>
                  <p className="text-[10px] uppercase text-muted-foreground">Kcal brûlé</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}


      {/* WEIGHT TRACKING */}
      <WeightTrackerCard
        goal={weightGoal}
        progress={goalProgress}
        currentWeight={currentWeight}
        weightLogs={weightLogs}
        todayWeight={todayWeight}
        setTodayWeight={setTodayWeight}
        onLog={logWeightToday}
        onSaveGoal={saveGoal}
      />

      {/* Toolbar */}
      <Card>
        <CardContent className="pt-4 pb-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setWeekStart(addDays(weekStart, -7))}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Précédente
            </Button>
            <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(now, { weekStartsOn: 1 }))}>
              Cette semaine
            </Button>
            <Button variant="outline" size="sm" onClick={() => setWeekStart(addDays(weekStart, 7))}>
              Suivante <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          <Button size="sm" onClick={copyFromLastWeek} className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:opacity-90 text-white">
            <Copy className="h-3.5 w-3.5 mr-1.5" /> Copier programme semaine précédente
          </Button>
        </CardContent>
      </Card>

      {/* Days */}
      <div className="space-y-4">
        {DAY_NAMES.map((d, i) => {
          const dateStr = format(weekDays[i], "yyyy-MM-dd");
          const sp = weeklySports.find((s: any) => s.day_index === i);
          const isCompleted = !!(sp?.completed);
          const kcalBurned = sp?.kcal_burned || 0;
          const isToday = isSameDay(weekDays[i], now);
          const dayTot = dayMealTotals(dateStr, true);
          const dayTotPlanned = dayMealTotals(dateStr, false);
          const netKcal = dayTot.kcal - BASAL_KCAL - kcalBurned;
          const hasData = dayTot.kcal > 0 || kcalBurned > 0;
          const isDeficitGoal = hasData && netKcal <= -300;
          const isSurplus = hasData && netKcal >= 300;

          return (
            <Card key={i} className={cn(
              "overflow-hidden transition-all border-2",
              isToday ? "border-primary shadow-lg ring-2 ring-primary/20" : "border-border/50",
              isCompleted && "border-green-400"
            )}>
              <CardHeader className={cn(
                "py-3 px-4",
                isCompleted ? "bg-gradient-to-r from-green-500/15 to-emerald-500/10" :
                isToday ? "bg-primary/8" : "bg-muted/30"
              )}>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleCompleted(i)}
                      className={cn(
                        "h-9 w-9 rounded-lg border-2 flex items-center justify-center transition-all shrink-0",
                        isCompleted ? "border-green-500 bg-green-500 text-white shadow" : "border-muted-foreground/30 hover:border-green-400 bg-background"
                      )}
                    >
                      {isCompleted && <CheckSquare className="h-4 w-4" />}
                    </button>
                    <div>
                      <CardTitle className={cn("text-base font-bold", isToday && "text-primary")}>
                        {d} <span className="text-sm font-normal text-muted-foreground">{format(weekDays[i], "d MMM", { locale: fr })}</span>
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-0.5">
                        {isCompleted && <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">✓ Séance validée</span>}
                        {isToday && !isCompleted && <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Aujourd'hui</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background border">
                      <Clock className="h-3.5 w-3.5 text-primary" />
                      <Input
                        type="time"
                        value={sp?.sport_time || ""}
                        onChange={(e) => updateLocalSport(i, { sport_time: e.target.value })}
                        onBlur={(e) => upsertSport(i, { sport_time: e.target.value || null })}
                        className="h-6 w-24 text-xs border-0 p-0 focus-visible:ring-0"
                      />
                    </div>
                    {hasData && (
                      <div className={cn(
                        "px-3 py-1 rounded-full text-xs font-black tabular-nums",
                        isDeficitGoal ? "bg-green-100 text-green-700" :
                        isSurplus ? "bg-red-100 text-red-700" :
                        "bg-amber-100 text-amber-700"
                      )}>
                        Net {netKcal > 0 ? "+" : ""}{Math.round(netKcal)} kcal
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-3 pb-4 space-y-4">
                {/* Programme + brûlé */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <Label className="text-[10px] flex items-center gap-1 mb-1"><Dumbbell className="h-3 w-3" /> Programme</Label>
                    <Textarea
                      placeholder="Ex: Pectoraux + triceps 45min, 15min cardio..."
                      value={sp?.program || ""}
                      onChange={(e) => updateLocalSport(i, { program: e.target.value })}
                      onBlur={(e) => upsertSport(i, { program: e.target.value })}
                      className="min-h-[50px] text-sm resize-none"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] flex items-center gap-1 mb-1"><Flame className="h-3 w-3 text-orange-500" /> Calories brûlées</Label>
                    <Input
                      type="number" placeholder="0" value={kcalBurned || ""}
                      onChange={(e) => updateLocalSport(i, { kcal_burned: parseInt(e.target.value) || 0 })}
                      onBlur={(e) => upsertSport(i, { kcal_burned: parseInt(e.target.value) || 0 })}
                      className="h-9 text-sm tabular-nums"
                    />
                    <Button
                      size="sm" variant="outline"
                      onClick={() => estimateBurnedKcal(i)}
                      disabled={!sp?.program?.trim() || estimatingBurn === i}
                      className="h-7 w-full mt-1 text-[11px]"
                    >
                      {estimatingBurn === i ? "⏳ Calcul…" : <><Flame className="h-3 w-3 mr-1 text-orange-500" /> Estimer auto</>}
                    </Button>
                  </div>
                </div>

                {/* Repas */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Utensils className="h-3.5 w-3.5" /> Repas du jour
                    </h4>
                    <div className="flex gap-3 text-[11px] text-muted-foreground">
                      <span>Mangé : <strong className="text-foreground tabular-nums">{Math.round(dayTot.kcal)}</strong> / <span className="tabular-nums">{Math.round(dayTotPlanned.kcal)}</span> kcal</span>
                      <span>Protéines : <strong className="text-emerald-600 tabular-nums">{Math.round(dayTot.protein)}g</strong></span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                    {MEAL_TYPES.map((mt) => {
                      const meal = meals.find((m: any) => m.day_date === dateStr && m.meal_type === mt.key);
                      const items = meal ? mealItemsFor(meal.id) : [];
                      const tot = meal ? mealTotals(meal.id) : { kcal: 0, protein: 0 };
                      const Icon = mt.icon;
                      const draftKey = `${dateStr}-${mt.key}`;
                      const draft = newItem[draftKey] || { name: "", kcal: "", protein: "" };
                      const isMealDone = !!meal?.completed;

                      return (
                        <div
                          key={mt.key}
                          className={cn(
                            "rounded-lg border p-2 transition-all",
                            isMealDone ? "bg-emerald-50/70 border-emerald-300 dark:bg-emerald-950/20" : "bg-card"
                          )}
                          style={!isMealDone ? { borderColor: `${mt.color}30` } : undefined}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: mt.color }} />
                              <span className="text-[11px] font-bold uppercase tracking-wider truncate" style={{ color: mt.color }}>{mt.label}</span>
                            </div>
                            <button
                              onClick={() => meal && toggleMealCompleted(dateStr, mt.key)}
                              disabled={!meal || items.length === 0}
                              className={cn(
                                "h-5 w-5 rounded border flex items-center justify-center transition-all shrink-0",
                                isMealDone ? "bg-emerald-500 border-emerald-500 text-white" :
                                items.length > 0 ? "border-emerald-400 hover:bg-emerald-50" : "border-border/40 opacity-40 cursor-not-allowed"
                              )}
                              title={items.length === 0 ? "Ajoute au moins 1 aliment" : "Marquer comme mangé"}
                            >
                              {isMealDone && <CheckSquare className="h-3 w-3" />}
                            </button>
                          </div>

                          {/* totals */}
                          {items.length > 0 && (
                            <div className="flex gap-1.5 mb-1.5 text-[10px]">
                              <span className="bg-orange-100 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 px-1.5 py-0.5 rounded font-bold tabular-nums">{Math.round(tot.kcal)} kcal</span>
                              <span className="bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded font-bold tabular-nums">{Math.round(tot.protein)}g P</span>
                            </div>
                          )}

                          {/* items list */}
                          <div className="space-y-0.5 mb-1.5">
                            {items.map((item: any) => (
                              <div key={item.id} className="flex items-center gap-1 text-[11px] group/item">
                                <span className="flex-1 truncate">{item.name}</span>
                                <span className="text-muted-foreground tabular-nums shrink-0">{Math.round(item.kcal)}/{Math.round(item.protein_g)}g</span>
                                <button onClick={() => deleteMealItem(item.id)} className="opacity-0 group-hover/item:opacity-100 text-destructive">
                                  <Trash2 className="h-2.5 w-2.5" />
                                </button>
                              </div>
                            ))}
                          </div>

                          {/* add item form — smart AI parsing */}
                          <div className="space-y-1">
                            <Input
                              placeholder='ex: "3 oeufs + 300g dinde"'
                              value={draft.name}
                              disabled={parsingKey === draftKey}
                              onChange={(e) => setNewItem(p => ({ ...p, [draftKey]: { ...draft, name: e.target.value } }))}
                              onKeyDown={(e) => e.key === "Enter" && addMealItemSmart(dateStr, mt.key)}
                              className="h-7 text-[11px]"
                            />
                            <Button
                              size="sm" variant="outline"
                              onClick={() => addMealItemSmart(dateStr, mt.key)}
                              disabled={!draft.name.trim() || parsingKey === draftKey}
                              className="h-7 w-full text-[11px]"
                            >
                              {parsingKey === draftKey ? (
                                <>⏳ Calcul…</>
                              ) : (
                                <><Plus className="h-3 w-3 mr-1" /> Ajouter (auto kcal/prot)</>
                              )}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ============== WEIGHT TRACKER COMPONENT ==============
function WeightTrackerCard({ goal, progress, currentWeight, weightLogs, todayWeight, setTodayWeight, onLog, onSaveGoal }: any) {
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalStart, setGoalStart] = useState<string>(goal?.start_weight_kg?.toString() || "93.5");
  const [goalTarget, setGoalTarget] = useState<string>(goal?.target_weight_kg?.toString() || "90");
  const [goalDate, setGoalDate] = useState<string>(goal?.target_date || "2026-05-31");

  useEffect(() => {
    if (goal) {
      setGoalStart(goal.start_weight_kg.toString());
      setGoalTarget(goal.target_weight_kg.toString());
      setGoalDate(goal.target_date);
    }
  }, [goal]);

  const handleSaveGoal = () => {
    const s = parseFloat(goalStart), t = parseFloat(goalTarget);
    if (isNaN(s) || isNaN(t)) return;
    onSaveGoal(s, t, goalDate);
    setEditingGoal(false);
    toast({ title: "Objectif mis à jour 🎯" });
  };

  const motivationalMsg = (() => {
    if (!progress) return "Enregistre ton poids pour démarrer le suivi";
    if (progress.pct >= 100) return "🏆 Objectif atteint ! Bravo champion !";
    if (progress.pct >= 75) return "🔥 Tu y es presque, continue !";
    if (progress.pct >= 50) return "💪 Plus de la moitié du chemin parcouru !";
    if (progress.pct >= 25) return "⚡ Belle dynamique, tiens bon !";
    if (progress.pct > 0) return "🚀 C'est parti, premiers résultats visibles !";
    return "🎯 Le chemin commence aujourd'hui";
  })();

  return (
    <Card className="overflow-hidden border-2 border-primary/20 shadow-lg">
      <div
        className="p-5"
        style={{ background: "linear-gradient(135deg, hsl(280, 60%, 25%) 0%, hsl(220, 70%, 30%) 100%)" }}
      >
        <div className="flex items-center justify-between flex-wrap gap-4 text-white">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Scale className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight">Objectif poids</h3>
              <p className="text-xs opacity-80">{motivationalMsg}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number" step="0.1" placeholder="Poids du jour"
              value={todayWeight}
              onChange={(e) => setTodayWeight(e.target.value)}
              className="h-9 w-32 text-sm tabular-nums bg-white/95 text-foreground"
            />
            <Button size="sm" onClick={onLog} disabled={!todayWeight} className="bg-white text-primary hover:bg-white/90">
              Enregistrer
            </Button>
          </div>
        </div>
      </div>

      <CardContent className="p-5 space-y-4">
        {progress ? (
          <>
            {/* Big numbers */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Départ</p>
                <p className="text-2xl font-black tabular-nums mt-1">{progress.start.toFixed(1)}<span className="text-xs text-muted-foreground ml-0.5">kg</span></p>
              </div>
              <div className="text-center p-3 rounded-lg bg-primary/10 border-2 border-primary/30">
                <p className="text-[10px] uppercase tracking-wider text-primary font-bold">Actuel</p>
                <p className="text-2xl font-black tabular-nums mt-1 text-primary">{progress.current.toFixed(1)}<span className="text-xs ml-0.5">kg</span></p>
              </div>
              <div className="text-center p-3 rounded-lg bg-emerald-500/10 border-2 border-emerald-500/30">
                <p className="text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-bold flex items-center justify-center gap-1"><Target className="h-3 w-3" /> Cible</p>
                <p className="text-2xl font-black tabular-nums mt-1 text-emerald-700 dark:text-emerald-400">{progress.target.toFixed(1)}<span className="text-xs ml-0.5">kg</span></p>
              </div>
              <div className="text-center p-3 rounded-lg bg-amber-500/10 border-2 border-amber-500/30">
                <p className="text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-400 font-bold">Reste</p>
                <p className="text-2xl font-black tabular-nums mt-1 text-amber-700 dark:text-amber-400">{progress.remaining > 0 ? progress.remaining.toFixed(1) : 0}<span className="text-xs ml-0.5">kg</span></p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{progress.daysLeft > 0 ? `${progress.daysLeft}j restants` : "Échéance dépassée"}</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold flex items-center gap-1.5">
                  <Trophy className="h-4 w-4 text-amber-500" /> Progression
                </span>
                <span className="font-black text-lg tabular-nums">{progress.pct.toFixed(0)}%</span>
              </div>
              <div className="h-4 bg-muted rounded-full overflow-hidden relative">
                <div
                  className="h-full transition-all duration-700 rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600 shadow-md"
                  style={{ width: `${progress.pct}%` }}
                />
                {progress.pct >= 100 && (
                  <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white">🏆 OBJECTIF ATTEINT</div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Tu as perdu <strong className="text-emerald-600">{progress.lostSoFar.toFixed(1)} kg</strong> sur {progress.totalToLose.toFixed(1)} kg objectif
              </p>
            </div>
          </>
        ) : (
          <div className="text-center py-4 text-sm text-muted-foreground">
            {currentWeight === null
              ? "Enregistre ton poids du jour pour activer le suivi."
              : "Configure ton objectif ci-dessous."}
          </div>
        )}

        {/* Goal config */}
        <div className="pt-3 border-t">
          {!editingGoal ? (
            <Button variant="outline" size="sm" onClick={() => setEditingGoal(true)} className="w-full">
              <Target className="h-3.5 w-3.5 mr-1.5" /> {goal ? "Modifier l'objectif" : "Définir mon objectif"}
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-[10px]">Poids départ</Label>
                  <Input type="number" step="0.1" value={goalStart} onChange={(e) => setGoalStart(e.target.value)} className="h-9 tabular-nums" />
                </div>
                <div>
                  <Label className="text-[10px]">Poids cible</Label>
                  <Input type="number" step="0.1" value={goalTarget} onChange={(e) => setGoalTarget(e.target.value)} className="h-9 tabular-nums" />
                </div>
                <div>
                  <Label className="text-[10px]">Date cible</Label>
                  <Input type="date" value={goalDate} onChange={(e) => setGoalDate(e.target.value)} className="h-9" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveGoal} className="flex-1">Sauvegarder</Button>
                <Button size="sm" variant="outline" onClick={() => setEditingGoal(false)}>Annuler</Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
