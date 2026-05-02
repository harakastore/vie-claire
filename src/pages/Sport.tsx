import { useEffect, useState } from "react";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { CheckSquare, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

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

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await (supabase.from("weekly_sports" as any) as any).select("*").eq("week_start", wsStr);
      setWeeklySports(data || []);
      setLoading(false);
    })();
  }, [user, wsStr]);

  const saveSportsProgram = async (dayIndex: number, program: string) => {
    if (!user) return;
    const existing = weeklySports.find((s: any) => s.day_index === dayIndex && s.id);
    if (existing) {
      await (supabase.from("weekly_sports" as any) as any).update({ program } as any).eq("id", existing.id);
    } else {
      const { data } = await (supabase.from("weekly_sports" as any) as any).insert({ user_id: user.id, week_start: wsStr, day_index: dayIndex, program }).select().single();
      if (data) setWeeklySports((prev) => prev.map((s) => s.day_index === dayIndex && !s.id ? data : s));
    }
  };

  const saveSportsKcal = async (dayIndex: number, field: "kcal_eaten" | "kcal_burned", value: number) => {
    if (!user) return;
    const existing = weeklySports.find((s: any) => s.day_index === dayIndex && s.id);
    if (existing) {
      await (supabase.from("weekly_sports" as any) as any).update({ [field]: value } as any).eq("id", existing.id);
    } else {
      const payload: any = { user_id: user.id, week_start: wsStr, day_index: dayIndex, program: "", [field]: value };
      const { data } = await (supabase.from("weekly_sports" as any) as any).insert(payload).select().single();
      if (data) setWeeklySports((prev) => prev.map((s) => s.day_index === dayIndex && !s.id ? data : s));
    }
  };

  const toggleSportCompleted = async (dayIndex: number) => {
    if (!user) return;
    const existing = weeklySports.find((s: any) => s.day_index === dayIndex);
    if (existing?.id) {
      const newCompleted = !existing.completed;
      setWeeklySports((prev) => prev.map((s) => s.day_index === dayIndex ? { ...s, completed: newCompleted } : s));
      await (supabase.from("weekly_sports" as any) as any).update({ completed: newCompleted } as any).eq("id", existing.id);
    } else {
      const { data } = await (supabase.from("weekly_sports" as any) as any).insert({ user_id: user.id, week_start: wsStr, day_index: dayIndex, program: "", completed: true }).select().single();
      if (data) setWeeklySports((prev) => [...prev.filter((s) => s.day_index !== dayIndex), data]);
    }
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Chargement…</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader title="🏋️ Programme Sport" description="Programme hebdomadaire et suivi calorique" />

      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => setWeekStart(addDays(weekStart, -7))}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Précédente
            </Button>
            <p className="text-sm font-semibold">
              Semaine du {format(weekStart, "d MMM", { locale: fr })} au {format(addDays(weekStart, 6), "d MMM yyyy", { locale: fr })}
            </p>
            <Button variant="outline" size="sm" onClick={() => setWeekStart(addDays(weekStart, 7))}>
              Suivante <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          {DAY_NAMES.map((d, i) => {
            const sp = weeklySports.find((s: any) => s.day_index === i);
            const isCompleted = !!(sp?.completed);
            const kcalEaten = sp?.kcal_eaten || 0;
            const kcalBurned = sp?.kcal_burned || 0;
            const netKcal = kcalEaten - BASAL_KCAL - kcalBurned;
            const isDeficitGoal = netKcal <= -500;
            const isSurplus = netKcal >= 300;
            return (
              <div key={i} className={cn(
                "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                isSameDay(weekDays[i], now) ? "border-primary/50 bg-primary/5" : "border-border/50",
                isCompleted && "border-green-400/50"
              )} style={isCompleted ? { backgroundColor: "hsl(150, 50%, 95%)" } : undefined}>
                <button
                  onClick={() => toggleSportCompleted(i)}
                  className={cn(
                    "h-6 w-6 mt-2 rounded border-2 flex items-center justify-center transition-colors shrink-0",
                    isCompleted ? "border-green-500 bg-green-500 text-white" : "border-muted-foreground/30 hover:border-green-400"
                  )}
                >
                  {isCompleted && <CheckSquare className="h-4 w-4" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn("text-sm font-bold", isSameDay(weekDays[i], now) ? "text-primary" : "text-foreground")}>{d}</span>
                    <span className="text-xs text-muted-foreground">{format(weekDays[i], "d MMM", { locale: fr })}</span>
                    {isCompleted && <span className="text-[10px] font-medium text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">✓ Fait</span>}
                  </div>
                  <Textarea
                    placeholder="Programme sport du jour..."
                    value={sp?.program || ""}
                    onChange={(e) => {
                      setWeeklySports((prev) => {
                        const idx = prev.findIndex((s: any) => s.day_index === i);
                        if (idx >= 0) {
                          const updated = [...prev];
                          updated[idx] = { ...updated[idx], program: e.target.value };
                          return updated;
                        }
                        return [...prev, { day_index: i, program: e.target.value, completed: false, kcal_eaten: 0, kcal_burned: 0 }];
                      });
                    }}
                    onBlur={(e) => saveSportsProgram(i, e.target.value)}
                    className="min-h-[50px] text-xs resize-none border-dashed bg-transparent p-1.5 focus-visible:ring-1"
                  />
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">🍽 Mangé (kcal)</Label>
                      <Input
                        type="number" placeholder="0" value={kcalEaten || ""}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setWeeklySports((prev) => {
                            const idx = prev.findIndex((s: any) => s.day_index === i);
                            if (idx >= 0) { const u = [...prev]; u[idx] = { ...u[idx], kcal_eaten: val }; return u; }
                            return [...prev, { day_index: i, program: "", completed: false, kcal_eaten: val, kcal_burned: 0 }];
                          });
                        }}
                        onBlur={(e) => saveSportsKcal(i, "kcal_eaten", parseInt(e.target.value) || 0)}
                        className="h-7 text-xs mt-0.5"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">🔥 Brûlé sport (kcal)</Label>
                      <Input
                        type="number" placeholder="0" value={kcalBurned || ""}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setWeeklySports((prev) => {
                            const idx = prev.findIndex((s: any) => s.day_index === i);
                            if (idx >= 0) { const u = [...prev]; u[idx] = { ...u[idx], kcal_burned: val }; return u; }
                            return [...prev, { day_index: i, program: "", completed: false, kcal_eaten: 0, kcal_burned: val }];
                          });
                        }}
                        onBlur={(e) => saveSportsKcal(i, "kcal_burned", parseInt(e.target.value) || 0)}
                        className="h-7 text-xs mt-0.5"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">📊 Net (base 2000)</Label>
                      <div className={cn(
                        "h-7 mt-0.5 flex items-center justify-center rounded-md text-xs font-bold border",
                        kcalEaten === 0 && kcalBurned === 0 ? "text-muted-foreground border-border/50"
                          : isDeficitGoal ? "text-green-700 bg-green-100 border-green-300"
                          : isSurplus ? "text-red-700 bg-red-100 border-red-300"
                          : "text-amber-700 bg-amber-50 border-amber-300"
                      )}>
                        {kcalEaten === 0 && kcalBurned === 0 ? "—" : `${netKcal > 0 ? "+" : ""}${netKcal}`}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
