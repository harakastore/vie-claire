import { useEffect, useMemo, useState } from "react";
import { format, addDays, parseISO, differenceInCalendarDays, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Flame, Trophy, RotateCcw, Utensils, Dumbbell, Sun } from "lucide-react";

const CHALLENGE_DAYS = 15;
const FORCED_START = "2026-05-02"; // Samedi 2 mai 2026 → 16 mai 2026

type ChallengeDay = { day_number: number; sport: boolean; deficit: boolean; fajr: boolean };

const FIELDS = [
  { key: "deficit" as const, label: "Déficit", icon: Utensils, color: "hsl(15, 90%, 55%)" },
  { key: "sport"   as const, label: "Sport",   icon: Dumbbell, color: "hsl(220, 80%, 55%)" },
  { key: "fajr"    as const, label: "Fajr",    icon: Sun,      color: "hsl(45, 95%, 55%)" },
];

export default function HighPerformance() {
  const { user } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");

  const [challengeStart] = useState<string>(FORCED_START);
  const [days, setDays] = useState<ChallengeDay[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDays = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("hp_challenge")
      .select("*")
      .eq("user_id", user.id)
      .eq("challenge_start", FORCED_START)
      .order("day_number", { ascending: true });
    const mapped = (data || [])
      .filter((c: any) => c.day_number <= CHALLENGE_DAYS)
      .map((c: any) => ({ day_number: c.day_number, sport: c.sport, deficit: c.deficit, fajr: c.fajr }));
    setDays(mapped);
    setLoading(false);
  };

  useEffect(() => { fetchDays(); }, [user]);

  const reset = async () => {
    if (!user) return;
    await supabase.from("hp_challenge").delete().eq("user_id", user.id).eq("challenge_start", FORCED_START);
    setDays([]);
    toast({ title: "Challenge réinitialisé", description: "Toutes les cases sont remises à zéro." });
  };

  const toggle = async (dayNum: number, field: "sport" | "deficit" | "fajr") => {
    if (!user) return;
    const existing = days.find(d => d.day_number === dayNum) || { day_number: dayNum, sport: false, deficit: false, fajr: false };
    const updated = { ...existing, [field]: !existing[field] };
    setDays(prev => {
      const others = prev.filter(d => d.day_number !== dayNum);
      return [...others, updated].sort((a, b) => a.day_number - b.day_number);
    });
    const { error } = await supabase.from("hp_challenge").upsert(
      { user_id: user.id, challenge_start: FORCED_START, ...updated },
      { onConflict: "user_id,challenge_start,day_number" }
    );
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
  };

  const startDate = parseISO(FORCED_START);
  const endDate = addDays(startDate, CHALLENGE_DAYS - 1);

  const todayDayNum = useMemo(() => {
    const diff = differenceInCalendarDays(new Date(today), startDate) + 1;
    return diff >= 1 && diff <= CHALLENGE_DAYS ? diff : null;
  }, [today]);

  const totalChecks = days.reduce((acc, d) => acc + (d.sport ? 1 : 0) + (d.deficit ? 1 : 0) + (d.fajr ? 1 : 0), 0);
  const max = CHALLENGE_DAYS * 3;
  const pct = Math.round((totalChecks / max) * 100);
  const perfectDays = days.filter(d => d.sport && d.deficit && d.fajr).length;
  const streak = useMemo(() => {
    let s = 0;
    for (let i = 1; i <= CHALLENGE_DAYS; i++) {
      const d = days.find(x => x.day_number === i);
      if (d && d.sport && d.deficit && d.fajr) s++;
      else break;
    }
    return s;
  }, [days]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Chargement…</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* HERO */}
      <div
        className="rounded-2xl p-6 shadow-xl text-white relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, hsl(15, 90%, 50%), hsl(35, 95%, 50%) 60%, hsl(345, 85%, 55%))" }}
      >
        <div className="absolute -bottom-10 -right-10 opacity-10"><Flame className="h-56 w-56" /></div>
        <div className="relative flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur rounded-full px-3 py-1 text-xs font-bold mb-2">
              🔥 CHALLENGE 15 JOURS
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Discipline Absolue</h1>
            <p className="text-sm sm:text-base opacity-90 mt-2 max-w-xl">
              Du <span className="font-bold">{format(startDate, "EEEE d MMMM", { locale: fr })}</span> au <span className="font-bold">{format(endDate, "EEEE d MMMM yyyy", { locale: fr })}</span>
            </p>
            <p className="text-xs opacity-80 mt-1">Chaque jour : 🍽 Déficit calorique · 🏋️ Sport · 🕌 Salat Al Fajr</p>
          </div>

          <div className="grid grid-cols-3 gap-3 min-w-[280px]">
            <div className="bg-white/15 backdrop-blur rounded-xl p-3 text-center">
              <Trophy className="h-4 w-4 mx-auto mb-1 text-yellow-300" />
              <p className="text-xl font-black tabular-nums">{pct}%</p>
              <p className="text-[10px] opacity-80 uppercase tracking-wider">Score</p>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-xl p-3 text-center">
              <p className="text-xl font-black tabular-nums">{perfectDays}/{CHALLENGE_DAYS}</p>
              <p className="text-[10px] opacity-80 uppercase tracking-wider">Parfaits</p>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-xl p-3 text-center">
              <Flame className="h-4 w-4 mx-auto mb-1 text-orange-200" />
              <p className="text-xl font-black tabular-nums">{streak}</p>
              <p className="text-[10px] opacity-80 uppercase tracking-wider">Streak</p>
            </div>
          </div>
        </div>

        {/* progress bar */}
        <div className="relative mt-5 h-3 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-yellow-300 to-white rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="relative flex items-center justify-between mt-2 text-xs opacity-90">
          <span className="tabular-nums font-bold">{totalChecks}/{max} validations</span>
          {todayDayNum && <span className="font-bold">📍 Jour {todayDayNum} aujourd'hui</span>}
          <button onClick={reset} className="inline-flex items-center gap-1 underline opacity-80 hover:opacity-100">
            <RotateCcw className="h-3 w-3" /> Réinitialiser
          </button>
        </div>
      </div>

      {/* Grille jours */}
      <Card className="border-2" style={{ borderColor: "hsl(15, 90%, 55% / 0.25)" }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            Suivi quotidien — coche chaque case validée
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {Array.from({ length: CHALLENGE_DAYS }, (_, i) => {
              const num = i + 1;
              const d = days.find(x => x.day_number === num) || { day_number: num, sport: false, deficit: false, fajr: false };
              const score = (d.sport ? 1 : 0) + (d.deficit ? 1 : 0) + (d.fajr ? 1 : 0);
              const date = addDays(startDate, i);
              const isToday = todayDayNum === num;
              const isPast = differenceInCalendarDays(new Date(today), date) > 0;
              const isFuture = date > new Date(today) && !isToday;

              const cardBg = score === 3
                ? "linear-gradient(135deg, hsl(140, 70%, 50%), hsl(160, 70%, 45%))"
                : score === 2
                  ? "linear-gradient(135deg, hsl(48, 95%, 60%), hsl(35, 95%, 60%))"
                  : score === 1
                    ? "linear-gradient(135deg, hsl(25, 90%, 65%), hsl(15, 90%, 60%))"
                    : isPast
                      ? "linear-gradient(135deg, hsl(0, 75%, 60%), hsl(345, 75%, 55%))"
                      : "linear-gradient(135deg, hsl(220, 15%, 95%), hsl(220, 15%, 92%))";

              const isColored = score > 0 || isPast;

              return (
                <div
                  key={num}
                  className={cn(
                    "rounded-xl border-2 p-3 space-y-2 transition-all hover:scale-[1.02] hover:shadow-lg",
                    isToday ? "ring-4 ring-orange-500 ring-offset-2 shadow-xl" : "border-transparent",
                    isFuture && "opacity-75"
                  )}
                  style={{ background: cardBg }}
                >
                  <div className={cn("flex items-center justify-between", isColored ? "text-white" : "text-foreground")}>
                    <div>
                      <p className="text-[10px] uppercase opacity-80 leading-none">Jour</p>
                      <p className="text-2xl font-black leading-none tabular-nums">{num}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase opacity-80 leading-none">{format(date, "EEE", { locale: fr })}</p>
                      <p className="text-sm font-bold leading-none tabular-nums">{format(date, "d MMM", { locale: fr })}</p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {FIELDS.map(({ key, label, icon: Icon }) => (
                      <button
                        key={key}
                        onClick={() => toggle(num, key)}
                        className={cn(
                          "w-full flex items-center justify-between gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all",
                          d[key]
                            ? "bg-white/95 text-green-700 shadow-sm"
                            : isColored
                              ? "bg-black/25 text-white hover:bg-black/35"
                              : "bg-white/80 text-muted-foreground hover:bg-white"
                        )}
                      >
                        <span className="flex items-center gap-1.5">
                          <Icon className="h-3.5 w-3.5" />
                          {label}
                        </span>
                        <span className="text-base leading-none">{d[key] ? "✓" : "○"}</span>
                      </button>
                    ))}
                  </div>

                  <div className={cn("text-center text-xs font-black tabular-nums pt-1.5 border-t",
                    isColored ? "text-white border-white/30" : "text-foreground border-border")}>
                    {score}/3 {score === 3 && "🏆"}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
