import { useEffect, useState } from "react";
import { format, parseISO, subDays, eachDayOfInterval, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { BarChart3 } from "lucide-react";

const habitVisibleOnDate = (h: any, dateStr: string) => {
  const days = h.days_of_week as number[] | null | undefined;
  if (!days || days.length === 0) return true;
  const dow = new Date(dateStr + "T00:00:00").getDay();
  return days.includes(dow);
};

export default function Discipline() {
  const { user } = useAuth();
  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");

  const [dailyHabits, setDailyHabits] = useState<any[]>([]);
  const [habitLogs, setHabitLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [disciplineFrom, setDisciplineFrom] = useState(format(subDays(now, 6), "yyyy-MM-dd"));
  const [disciplineTo, setDisciplineTo] = useState(format(now, "yyyy-MM-dd"));

  const fetchAll = async () => {
    if (!user) return;
    setLoading(true);
    const [dh, dhl] = await Promise.all([
      (supabase.from("daily_habits" as any) as any).select("*").eq("active", true).order("sort_order"),
      (supabase.from("daily_habit_logs" as any) as any).select("*").gte("day_date", disciplineFrom).lte("day_date", disciplineTo),
    ]);
    setDailyHabits(dh.data || []);
    setHabitLogs(dhl.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [user, disciplineFrom, disciplineTo]);

  const isHabitCompleted = (habitId: string, dateStr: string) =>
    habitLogs.some((l: any) => l.habit_id === habitId && l.day_date === dateStr && l.completed);

  const toggleHabitLog = async (habitId: string, dateStr: string) => {
    if (!user) return;
    const existing = habitLogs.find((l: any) => l.habit_id === habitId && l.day_date === dateStr);
    if (existing) {
      setHabitLogs((prev) => prev.map((l) => l.id === existing.id ? { ...l, completed: !existing.completed } : l));
      await (supabase.from("daily_habit_logs" as any) as any).update({ completed: !existing.completed }).eq("id", existing.id);
    } else {
      const tempId = `temp-${Date.now()}`;
      const temp = { id: tempId, user_id: user.id, habit_id: habitId, day_date: dateStr, completed: true };
      setHabitLogs((prev) => [...prev, temp]);
      const { data } = await (supabase.from("daily_habit_logs" as any) as any).insert({ user_id: user.id, habit_id: habitId, day_date: dateStr, completed: true }).select().single();
      if (data) setHabitLogs((prev) => prev.map((l) => l.id === tempId ? data : l));
    }
  };

  const disciplineDays = (() => {
    try {
      return eachDayOfInterval({ start: parseISO(disciplineFrom), end: parseISO(disciplineTo) });
    } catch { return []; }
  })();

  const perso = dailyHabits.filter((h) => (h.category || "personal") === "personal" && habitVisibleOnDate(h, todayStr));
  const biz = dailyHabits.filter((h) => h.category === "business" && habitVisibleOnDate(h, todayStr));
  const recur = dailyHabits.filter((h) => h.category === "recurring" && habitVisibleOnDate(h, todayStr));

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Chargement…</div>;

  const renderGroup = (title: string, items: any[], bg: string, color: string) => (
    <div className="rounded-md p-4 border" style={{ backgroundColor: bg }}>
      <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color }}>{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Aucun pour aujourd'hui</p>
      ) : items.map((h) => (
        <div key={h.id} className="flex items-center gap-2 py-1">
          <Checkbox checked={isHabitCompleted(h.id, todayStr)} onCheckedChange={() => toggleHabitLog(h.id, todayStr)} className="h-4 w-4" />
          <span className={cn("text-sm font-medium", isHabitCompleted(h.id, todayStr) && "line-through text-muted-foreground")}>{h.title}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader title="🔒 Discipline" description={`Non-négociables d'aujourd'hui — ${format(now, "EEEE d MMMM yyyy", { locale: fr })}`} />

      {/* Non-négociables du jour */}
      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {renderGroup("🔒 Personnel", perso, "hsl(200, 70%, 95%)", "hsl(200, 70%, 30%)")}
          {renderGroup("💼 Business", biz, "hsl(30, 80%, 94%)", "hsl(30, 80%, 40%)")}
          {renderGroup("📅 Récurrentes", recur, "hsl(270, 60%, 95%)", "hsl(270, 60%, 40%)")}
        </CardContent>
      </Card>

      {/* Dashboard Discipline */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-base font-semibold flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Dashboard Discipline</p>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">Du</Label>
                <Input type="date" value={disciplineFrom} onChange={(e) => setDisciplineFrom(e.target.value)} className="h-8 text-xs w-auto" />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">Au</Label>
                <Input type="date" value={disciplineTo} onChange={(e) => setDisciplineTo(e.target.value)} className="h-8 text-xs w-auto" />
              </div>
            </div>
          </div>

          {dailyHabits.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune habitude configurée. Va sur Objectifs pour en créer.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="border border-border/50 px-2 py-2 text-xs font-semibold text-left sticky left-0 bg-background z-10">Habitude</th>
                    {disciplineDays.map((d) => (
                      <th key={format(d, "yyyy-MM-dd")} className={cn(
                        "border border-border/50 px-1 py-2 text-[10px] font-semibold text-center min-w-[40px]",
                        isSameDay(d, now) && "bg-primary/10 text-primary"
                      )}>
                        <div>{format(d, "EEE", { locale: fr })}</div>
                        <div>{format(d, "d")}</div>
                      </th>
                    ))}
                    <th className="border border-border/50 px-2 py-2 text-xs font-semibold text-center">%</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyHabits.map((h) => {
                    const completedCount = disciplineDays.filter((d) => isHabitCompleted(h.id, format(d, "yyyy-MM-dd"))).length;
                    const pct = disciplineDays.length > 0 ? Math.round((completedCount / disciplineDays.length) * 100) : 0;
                    return (
                      <tr key={h.id}>
                        <td className="border border-border/50 px-2 py-1.5 text-xs font-medium sticky left-0 bg-background z-10 whitespace-nowrap">{h.title}</td>
                        {disciplineDays.map((d) => {
                          const dateStr = format(d, "yyyy-MM-dd");
                          const done = isHabitCompleted(h.id, dateStr);
                          return (
                            <td key={dateStr} className="border border-border/50 text-center p-0">
                              <button
                                onClick={() => toggleHabitLog(h.id, dateStr)}
                                className={cn("w-full h-8 text-sm transition-colors",
                                  done ? "bg-green-500/20 text-green-600" : "hover:bg-muted/50")}
                              >
                                {done ? "✓" : ""}
                              </button>
                            </td>
                          );
                        })}
                        <td className={cn("border border-border/50 px-2 py-1.5 text-xs font-bold text-center",
                          pct >= 80 ? "text-green-600" : pct >= 50 ? "text-yellow-600" : "text-red-500")}>
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
