import { useEffect, useState } from "react";
import { format, startOfWeek, addDays, isSameDay, subWeeks } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { CheckSquare, ChevronLeft, ChevronRight, Dumbbell, Flame, TrendingDown, TrendingUp, Copy, Utensils } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const DAY_NAMES = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const BASAL_KCAL = 2000;

export default function Sport() {
  const { user } = useAuth();
  const now = new Date();
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(now, { weekStartsOn: 1 }));
  const wsStr = format(weekStart, "yyyy-MM-dd");
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const [weeklySports, setWeeklySports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWeek = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await (supabase.from("weekly_sports" as any) as any).select("*").eq("week_start", wsStr);
    setWeeklySports(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchWeek(); }, [user, wsStr]);

  const upsertSport = async (dayIndex: number, patch: Partial<{ program: string; kcal_eaten: number; kcal_burned: number; completed: boolean }>) => {
    if (!user) return;
    const existing = weeklySports.find((s: any) => s.day_index === dayIndex && s.id);
    if (existing) {
      await (supabase.from("weekly_sports" as any) as any).update(patch as any).eq("id", existing.id);
    } else {
      const payload: any = { user_id: user.id, week_start: wsStr, day_index: dayIndex, program: "", kcal_eaten: 0, kcal_burned: 0, completed: false, ...patch };
      const { data } = await (supabase.from("weekly_sports" as any) as any).insert(payload).select().single();
      if (data) setWeeklySports((prev) => prev.map((s) => s.day_index === dayIndex && !s.id ? data : s));
    }
  };

  const updateLocal = (dayIndex: number, patch: any) => {
    setWeeklySports((prev) => {
      const idx = prev.findIndex((s: any) => s.day_index === dayIndex);
      if (idx >= 0) { const u = [...prev]; u[idx] = { ...u[idx], ...patch }; return u; }
      return [...prev, { day_index: dayIndex, program: "", completed: false, kcal_eaten: 0, kcal_burned: 0, ...patch }];
    });
  };

  const toggleCompleted = (dayIndex: number) => {
    const existing = weeklySports.find((s: any) => s.day_index === dayIndex);
    const newVal = !(existing?.completed);
    updateLocal(dayIndex, { completed: newVal });
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
    // Only copy program (not kcal/completion) — execution is fresh each week
    const rows = data.map((s: any) => ({
      user_id: user.id, week_start: wsStr, day_index: s.day_index,
      program: s.program || "", kcal_eaten: 0, kcal_burned: 0, completed: false,
    }));
    // Delete existing, then insert
    await (supabase.from("weekly_sports" as any) as any).delete().eq("user_id", user.id).eq("week_start", wsStr);
    await (supabase.from("weekly_sports" as any) as any).insert(rows);
    toast({ title: "Programme copié 📋", description: `${rows.length} jour(s) copié(s) depuis la semaine précédente.` });
    fetchWeek();
  };

  // Weekly aggregates
  const totalEaten = weeklySports.reduce((acc, s) => acc + (s.kcal_eaten || 0), 0);
  const totalBurned = weeklySports.reduce((acc, s) => acc + (s.kcal_burned || 0), 0);
  const totalNet = totalEaten - (BASAL_KCAL * 7) - totalBurned;
  const sportDays = weeklySports.filter((s) => s.completed).length;

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Chargement…</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* HERO */}
      <div
        className="rounded-2xl p-5 shadow-xl text-white relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, hsl(220, 80%, 45%), hsl(190, 75%, 45%) 60%, hsl(160, 70%, 40%))" }}
      >
        <div className="absolute -top-8 -right-8 opacity-10"><Dumbbell className="h-44 w-44" /></div>
        <div className="relative flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur rounded-full px-3 py-1 text-xs font-bold mb-2">
              🏋️ SPORT & NUTRITION
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Programme hebdomadaire</h1>
            <p className="text-sm opacity-90 mt-1">Semaine du {format(weekStart, "d MMM", { locale: fr })} au {format(addDays(weekStart, 6), "d MMM yyyy", { locale: fr })}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 min-w-[300px]">
            <div className="bg-white/15 backdrop-blur rounded-xl p-3 text-center">
              <Dumbbell className="h-4 w-4 mx-auto mb-1" />
              <p className="text-xl font-black tabular-nums">{sportDays}/7</p>
              <p className="text-[10px] opacity-80 uppercase">Sessions</p>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-xl p-3 text-center">
              <Utensils className="h-4 w-4 mx-auto mb-1" />
              <p className="text-xl font-black tabular-nums">{totalEaten}</p>
              <p className="text-[10px] opacity-80 uppercase">Kcal mangé</p>
            </div>
            <div className={cn(
              "rounded-xl p-3 text-center backdrop-blur",
              totalNet < 0 ? "bg-green-400/30" : totalNet > 1000 ? "bg-red-400/40" : "bg-white/15"
            )}>
              {totalNet < 0 ? <TrendingDown className="h-4 w-4 mx-auto mb-1" /> : <TrendingUp className="h-4 w-4 mx-auto mb-1" />}
              <p className="text-xl font-black tabular-nums">{totalNet > 0 ? "+" : ""}{totalNet}</p>
              <p className="text-[10px] opacity-80 uppercase">Net semaine</p>
            </div>
          </div>
        </div>
      </div>

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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DAY_NAMES.map((d, i) => {
          const sp = weeklySports.find((s: any) => s.day_index === i);
          const isCompleted = !!(sp?.completed);
          const kcalEaten = sp?.kcal_eaten || 0;
          const kcalBurned = sp?.kcal_burned || 0;
          const netKcal = kcalEaten - BASAL_KCAL - kcalBurned;
          const hasData = kcalEaten > 0 || kcalBurned > 0;
          const isDeficitGoal = hasData && netKcal <= -300;
          const isSurplus = hasData && netKcal >= 300;
          const isToday = isSameDay(weekDays[i], now);

          return (
            <Card key={i} className={cn(
              "overflow-hidden transition-all hover:shadow-md border-2",
              isToday ? "border-primary shadow-lg" : "border-border/50",
              isCompleted && "border-green-400"
            )}>
              <CardHeader className={cn(
                "py-3 px-4",
                isCompleted ? "bg-gradient-to-r from-green-500/15 to-emerald-500/10" :
                isToday ? "bg-primary/8" : "bg-muted/30"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleCompleted(i)}
                      className={cn(
                        "h-8 w-8 rounded-lg border-2 flex items-center justify-center transition-all shrink-0",
                        isCompleted ? "border-green-500 bg-green-500 text-white shadow" : "border-muted-foreground/30 hover:border-green-400 bg-background"
                      )}
                    >
                      {isCompleted && <CheckSquare className="h-4 w-4" />}
                    </button>
                    <div>
                      <CardTitle className={cn("text-base font-bold", isToday && "text-primary")}>
                        {d} <span className="text-sm font-normal text-muted-foreground">{format(weekDays[i], "d MMM", { locale: fr })}</span>
                      </CardTitle>
                      {isCompleted && <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">✓ Séance validée</span>}
                      {isToday && !isCompleted && <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Aujourd'hui</span>}
                    </div>
                  </div>
                  {hasData && (
                    <div className={cn(
                      "px-3 py-1 rounded-full text-xs font-black tabular-nums",
                      isDeficitGoal ? "bg-green-100 text-green-700" :
                      isSurplus ? "bg-red-100 text-red-700" :
                      "bg-amber-100 text-amber-700"
                    )}>
                      {netKcal > 0 ? "+" : ""}{netKcal} kcal
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-3 pb-4 space-y-3">
                <Textarea
                  placeholder="Programme du jour (ex: Pectoraux + triceps, 45min cardio...)"
                  value={sp?.program || ""}
                  onChange={(e) => updateLocal(i, { program: e.target.value })}
                  onBlur={(e) => upsertSport(i, { program: e.target.value })}
                  className="min-h-[60px] text-sm resize-none"
                />
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[10px] flex items-center gap-1"><Utensils className="h-3 w-3" /> Mangé</Label>
                    <Input
                      type="number" placeholder="0" value={kcalEaten || ""}
                      onChange={(e) => updateLocal(i, { kcal_eaten: parseInt(e.target.value) || 0 })}
                      onBlur={(e) => upsertSport(i, { kcal_eaten: parseInt(e.target.value) || 0 })}
                      className="h-9 text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] flex items-center gap-1"><Flame className="h-3 w-3 text-orange-500" /> Brûlé</Label>
                    <Input
                      type="number" placeholder="0" value={kcalBurned || ""}
                      onChange={(e) => updateLocal(i, { kcal_burned: parseInt(e.target.value) || 0 })}
                      onBlur={(e) => upsertSport(i, { kcal_burned: parseInt(e.target.value) || 0 })}
                      className="h-9 text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] flex items-center gap-1">
                      {isDeficitGoal ? <TrendingDown className="h-3 w-3 text-green-600" /> : <TrendingUp className="h-3 w-3" />} Net
                    </Label>
                    <div className={cn(
                      "h-9 mt-0 flex items-center justify-center rounded-md text-sm font-black border tabular-nums",
                      !hasData ? "text-muted-foreground border-border/50 bg-muted/30" :
                      isDeficitGoal ? "text-green-700 bg-green-100 border-green-300" :
                      isSurplus ? "text-red-700 bg-red-100 border-red-300" :
                      "text-amber-700 bg-amber-50 border-amber-300"
                    )}>
                      {!hasData ? "—" : `${netKcal > 0 ? "+" : ""}${netKcal}`}
                    </div>
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
