import { useEffect, useState } from "react";
import { format, addDays, parseISO, differenceInCalendarDays } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Flame, Trophy, RotateCcw } from "lucide-react";

const CHALLENGE_DAYS = 15;

type ChallengeDay = { day_number: number; sport: boolean; deficit: boolean; fajr: boolean };

export default function HighPerformance() {
  const { user } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");

  const [challengeStart, setChallengeStart] = useState<string | null>(null);
  const [days, setDays] = useState<ChallengeDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("hp_challenge")
        .select("*")
        .eq("user_id", user.id)
        .order("challenge_start", { ascending: false })
        .order("day_number", { ascending: true });
      if (data && data.length > 0) {
        const start = data[0].challenge_start;
        const all = data.filter((c: any) => c.challenge_start === start)
          .filter((c: any) => c.day_number <= CHALLENGE_DAYS);
        setChallengeStart(start);
        setDays(all.map((c: any) => ({ day_number: c.day_number, sport: c.sport, deficit: c.deficit, fajr: c.fajr })));
      }
      setLoading(false);
    })();
  }, [user]);

  const startChallenge = async () => {
    if (!user) return;
    const start = today;
    const rows = Array.from({ length: CHALLENGE_DAYS }, (_, i) => ({
      user_id: user.id, challenge_start: start, day_number: i + 1, sport: false, deficit: false, fajr: false,
    }));
    const { error } = await supabase.from("hp_challenge").upsert(rows, { onConflict: "user_id,challenge_start,day_number" });
    if (error) return toast({ title: "Erreur", description: error.message, variant: "destructive" });
    setChallengeStart(start);
    setDays(rows.map(r => ({ day_number: r.day_number, sport: false, deficit: false, fajr: false })));
    toast({ title: "Défi démarré 🔥", description: `${CHALLENGE_DAYS} jours de discipline à partir d'aujourd'hui` });
  };

  const toggle = async (dayNum: number, field: "sport" | "deficit" | "fajr") => {
    if (!user || !challengeStart) return;
    const existing = days.find(d => d.day_number === dayNum) || { day_number: dayNum, sport: false, deficit: false, fajr: false };
    const updated = { ...existing, [field]: !existing[field] };
    setDays(prev => {
      const others = prev.filter(d => d.day_number !== dayNum);
      return [...others, updated].sort((a, b) => a.day_number - b.day_number);
    });
    const { error } = await supabase.from("hp_challenge").upsert(
      { user_id: user.id, challenge_start: challengeStart, ...updated },
      { onConflict: "user_id,challenge_start,day_number" }
    );
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Chargement…</div>;

  if (!challengeStart || days.length === 0) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <PageHeader title="🔥 Challenge 15 jours" description="Discipline absolue: déficit calorique, sport, salat al Fajr" />
        <Card className="border-2 border-orange-300">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <Flame className="h-12 w-12 text-orange-500 mx-auto" />
            <p className="text-lg font-semibold">Prêt à démarrer ton défi de 15 jours ?</p>
            <p className="text-sm text-muted-foreground">Chaque jour: ✅ Déficit calorique · ✅ Sport · ✅ Salat Al Fajr</p>
            <Button size="lg" onClick={startChallenge} className="bg-orange-500 hover:bg-orange-600 text-white">
              Démarrer aujourd'hui 🚀
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const todayDayNum = (() => {
    const diff = differenceInCalendarDays(new Date(today), parseISO(challengeStart)) + 1;
    return diff >= 1 && diff <= CHALLENGE_DAYS ? diff : null;
  })();

  const totalChecks = days.reduce((acc, d) => acc + (d.sport ? 1 : 0) + (d.deficit ? 1 : 0) + (d.fajr ? 1 : 0), 0);
  const max = CHALLENGE_DAYS * 3;
  const pct = Math.round((totalChecks / max) * 100);
  const perfectDays = days.filter(d => d.sport && d.deficit && d.fajr).length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader title="🔥 Challenge 15 jours" description={`Démarré le ${format(parseISO(challengeStart), "EEEE d MMMM yyyy", { locale: fr })}`} />

      <Card className="border-2" style={{ borderColor: "hsl(15 90% 55% / 0.4)" }}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              Suivi quotidien
            </CardTitle>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <Trophy className="h-4 w-4 text-yellow-500" />
                <span className="font-bold tabular-nums">{totalChecks}/{max}</span>
                <span className="text-muted-foreground">({pct}%)</span>
              </div>
              <div className="text-muted-foreground">
                Jours parfaits: <span className="font-bold text-green-600">{perfectDays}/{CHALLENGE_DAYS}</span>
              </div>
              <Button size="sm" variant="outline" onClick={startChallenge}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Redémarrer
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {Array.from({ length: CHALLENGE_DAYS }, (_, i) => {
              const num = i + 1;
              const d = days.find(x => x.day_number === num) || { day_number: num, sport: false, deficit: false, fajr: false };
              const score = (d.sport ? 1 : 0) + (d.deficit ? 1 : 0) + (d.fajr ? 1 : 0);
              const date = addDays(parseISO(challengeStart), i);
              const dateStr = format(date, "EEE d", { locale: fr });
              const isToday = todayDayNum === num;
              const isPast = differenceInCalendarDays(new Date(today), date) > 0;
              return (
                <div key={num} className={cn(
                  "rounded-lg border p-3 space-y-2 transition-all",
                  isToday && "ring-2 ring-orange-500",
                  score === 3 ? "bg-green-50 border-green-300 dark:bg-green-950/30 dark:border-green-700" :
                  score === 0 ? (isPast ? "bg-red-50 border-red-200" : "bg-card border-border") :
                  "bg-yellow-50 border-yellow-300 dark:bg-yellow-950/20 dark:border-yellow-800"
                )}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">J{num}</span>
                    <span className="text-[10px] text-muted-foreground capitalize">{dateStr}</span>
                  </div>
                  <div className="space-y-1">
                    {([
                      { key: "deficit" as const, label: "🍽 Déficit calorique" },
                      { key: "sport" as const, label: "🏋️ Sport" },
                      { key: "fajr" as const, label: "🕌 Salat Al Fajr" },
                    ]).map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => toggle(num, key)}
                        className={cn(
                          "w-full flex items-center justify-between gap-1 px-2 py-1.5 rounded text-[11px] font-medium transition-colors",
                          d[key]
                            ? "bg-green-500 text-white hover:bg-green-600"
                            : "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950/40 dark:text-red-300"
                        )}
                      >
                        <span className="truncate text-left">{label}</span>
                        <span className="font-bold">{d[key] ? "✓" : "✗"}</span>
                      </button>
                    ))}
                  </div>
                  <div className="text-center text-xs font-bold tabular-nums pt-1 border-t">{score}/3</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
