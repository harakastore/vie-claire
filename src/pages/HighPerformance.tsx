import { useEffect, useState } from "react";
import { format, addDays, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Flame, Target, Trophy, TrendingUp } from "lucide-react";

type DailyRow = {
  id?: string;
  day_date: string;
  priority1_title: string; priority1_done: boolean;
  priority2_title: string; priority2_done: boolean;
  priority3_title: string; priority3_done: boolean;
  salat_done: boolean;
  sport_done: boolean;
  deep_work_done: boolean;
  no_social_done: boolean;
  leads_count: number;
  cost_per_lead: number;
  revenue: number;
  notes: string;
};

const emptyDaily = (date: string): DailyRow => ({
  day_date: date,
  priority1_title: "", priority1_done: false,
  priority2_title: "", priority2_done: false,
  priority3_title: "", priority3_done: false,
  salat_done: false, sport_done: false, deep_work_done: false, no_social_done: false,
  leads_count: 0, cost_per_lead: 0, revenue: 0, notes: "",
});

type ChallengeDay = { day_number: number; sport: boolean; deficit: boolean; fajr: boolean };

export default function HighPerformance() {
  const { user } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");
  const [daily, setDaily] = useState<DailyRow>(emptyDaily(today));
  const [loading, setLoading] = useState(true);

  // Challenge
  const [challengeStart, setChallengeStart] = useState<string>(today);
  const [challengeDays, setChallengeDays] = useState<ChallengeDay[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("hp_daily").select("*").eq("user_id", user.id).eq("day_date", today).maybeSingle();
      if (data) setDaily(data as any);
      else setDaily(emptyDaily(today));

      // Load most recent challenge
      const { data: ch } = await supabase.from("hp_challenge").select("*").eq("user_id", user.id).order("challenge_start", { ascending: false }).limit(16);
      if (ch && ch.length > 0) {
        const start = ch[0].challenge_start;
        const all = ch.filter((c: any) => c.challenge_start === start);
        setChallengeStart(start);
        setChallengeDays(all.map((c: any) => ({ day_number: c.day_number, sport: c.sport, deficit: c.deficit, fajr: c.fajr })));
      }
      setLoading(false);
    })();
  }, [user, today]);

  const saveDaily = async (patch: Partial<DailyRow>) => {
    if (!user) return;
    const next = { ...daily, ...patch };
    setDaily(next);
    const payload = { ...next, user_id: user.id, day_date: today };
    const { error } = await supabase.from("hp_daily").upsert(payload, { onConflict: "user_id,day_date" });
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
  };

  const priorities = [
    { title: daily.priority1_title, done: daily.priority1_done, tKey: "priority1_title", dKey: "priority1_done" },
    { title: daily.priority2_title, done: daily.priority2_done, tKey: "priority2_title", dKey: "priority2_done" },
    { title: daily.priority3_title, done: daily.priority3_done, tKey: "priority3_title", dKey: "priority3_done" },
  ] as const;
  const prioDone = priorities.filter(p => p.done).length;

  const nonNego = [
    { label: "Salat", key: "salat_done" as const, value: daily.salat_done },
    { label: "Sport", key: "sport_done" as const, value: daily.sport_done },
    { label: "Deep Work (1+)", key: "deep_work_done" as const, value: daily.deep_work_done },
    { label: "No Social Media", key: "no_social_done" as const, value: daily.no_social_done },
  ];

  // ---------- Challenge ----------
  const startChallenge = async () => {
    if (!user) return;
    const start = today;
    const rows = Array.from({ length: 16 }, (_, i) => ({
      user_id: user.id, challenge_start: start, day_number: i + 1, sport: false, deficit: false, fajr: false,
    }));
    const { error } = await supabase.from("hp_challenge").upsert(rows, { onConflict: "user_id,challenge_start,day_number" });
    if (error) return toast({ title: "Erreur", description: error.message, variant: "destructive" });
    setChallengeStart(start);
    setChallengeDays(rows.map(r => ({ day_number: r.day_number, sport: false, deficit: false, fajr: false })));
    toast({ title: "Défi démarré 🔥", description: "16 jours de discipline" });
  };

  const toggleChallenge = async (dayNum: number, field: "sport" | "deficit" | "fajr") => {
    if (!user) return;
    const existing = challengeDays.find(d => d.day_number === dayNum) || { day_number: dayNum, sport: false, deficit: false, fajr: false };
    const updated = { ...existing, [field]: !existing[field] };
    setChallengeDays(prev => {
      const others = prev.filter(d => d.day_number !== dayNum);
      return [...others, updated].sort((a, b) => a.day_number - b.day_number);
    });
    const { error } = await supabase.from("hp_challenge").upsert(
      { user_id: user.id, challenge_start: challengeStart, ...updated },
      { onConflict: "user_id,challenge_start,day_number" }
    );
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
  };

  const todayDayNum = (() => {
    if (!challengeStart) return null;
    const diff = Math.floor((new Date(today).getTime() - parseISO(challengeStart).getTime()) / 86400000) + 1;
    return diff >= 1 && diff <= 16 ? diff : null;
  })();

  const totalChecks = challengeDays.reduce((acc, d) => acc + (d.sport ? 1 : 0) + (d.deficit ? 1 : 0) + (d.fajr ? 1 : 0), 0);
  const challengePct = Math.round((totalChecks / (16 * 3)) * 100);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Chargement…</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader title="High Performance System" description={`Mode exécution — ${format(new Date(), "EEEE dd MMM yyyy")}`} />

      {/* TOP 3 PRIORITIES */}
      <Card className="border-2 border-primary/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Top 3 Priorités du jour
            </CardTitle>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold tabular-nums">{prioDone}/3</span>
              <Progress value={(prioDone / 3) * 100} className="w-24 h-2" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {priorities.map((p, i) => (
            <div key={i} className={cn("flex items-center gap-3 p-3 rounded-md border transition-colors",
              p.done ? "bg-green-50 border-green-300 dark:bg-green-950/30 dark:border-green-800" : "bg-card border-border"
            )}>
              <Checkbox checked={p.done} onCheckedChange={(v) => saveDaily({ [p.dKey]: !!v } as any)} />
              <Input
                value={p.title}
                placeholder={`Priorité #${i + 1} — la tâche la plus impactante`}
                onChange={(e) => setDaily({ ...daily, [p.tKey]: e.target.value } as any)}
                onBlur={(e) => saveDaily({ [p.tKey]: e.target.value } as any)}
                className={cn("border-0 bg-transparent shadow-none focus-visible:ring-0 px-0", p.done && "line-through text-muted-foreground")}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* NON-NEGOTIABLES */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">⚡ Non-négociables essentiels</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {nonNego.map(n => (
            <button
              key={n.key}
              onClick={() => saveDaily({ [n.key]: !n.value } as any)}
              className={cn("flex items-center gap-2 p-3 rounded-md border text-sm font-medium transition-all",
                n.value
                  ? "bg-green-100 border-green-400 text-green-900 dark:bg-green-950/40 dark:border-green-700 dark:text-green-200"
                  : "bg-muted/30 border-border hover:bg-muted/60"
              )}
            >
              <Checkbox checked={n.value} className="pointer-events-none" />
              {n.label}
            </button>
          ))}
        </CardContent>
      </Card>

      {/* IMPACT TRACKER */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Impact Tracker (Business)
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Leads générés</label>
            <Input type="number" value={daily.leads_count}
              onChange={(e) => setDaily({ ...daily, leads_count: Number(e.target.value) })}
              onBlur={(e) => saveDaily({ leads_count: Number(e.target.value) })} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Coût par lead (DH)</label>
            <Input type="number" value={daily.cost_per_lead}
              onChange={(e) => setDaily({ ...daily, cost_per_lead: Number(e.target.value) })}
              onBlur={(e) => saveDaily({ cost_per_lead: Number(e.target.value) })} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Revenu (DH)</label>
            <Input type="number" value={daily.revenue}
              onChange={(e) => setDaily({ ...daily, revenue: Number(e.target.value) })}
              onBlur={(e) => saveDaily({ revenue: Number(e.target.value) })} />
          </div>
          <div className="md:col-span-3">
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <Textarea value={daily.notes} placeholder="Apprentissages, blockers, wins…"
              onChange={(e) => setDaily({ ...daily, notes: e.target.value })}
              onBlur={(e) => saveDaily({ notes: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      {/* 16-DAY CHALLENGE */}
      <Card className="border-2" style={{ borderColor: "hsl(15 90% 55% / 0.4)" }}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              16-Day Discipline Challenge
            </CardTitle>
            <div className="flex items-center gap-3">
              {challengeDays.length > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <Trophy className="h-4 w-4 text-yellow-500" />
                  <span className="font-bold tabular-nums">{totalChecks}/48</span>
                  <span className="text-muted-foreground">({challengePct}%)</span>
                </div>
              )}
              <Button size="sm" variant="outline" onClick={startChallenge}>
                {challengeDays.length > 0 ? "Redémarrer aujourd'hui" : "Démarrer le défi"}
              </Button>
            </div>
          </div>
          {challengeStart && challengeDays.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">Démarré le {format(parseISO(challengeStart), "dd MMM yyyy")}</p>
          )}
        </CardHeader>
        <CardContent>
          {challengeDays.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucun défi en cours. Démarre tes 16 jours 🔥</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 gap-3">
              {Array.from({ length: 16 }, (_, i) => {
                const num = i + 1;
                const d = challengeDays.find(x => x.day_number === num) || { day_number: num, sport: false, deficit: false, fajr: false };
                const score = (d.sport ? 1 : 0) + (d.deficit ? 1 : 0) + (d.fajr ? 1 : 0);
                const dateStr = format(addDays(parseISO(challengeStart), i), "dd/MM");
                const isToday = todayDayNum === num;
                return (
                  <div key={num} className={cn("rounded-md border p-2 space-y-1.5 transition-all",
                    isToday && "ring-2 ring-primary",
                    score === 3 ? "bg-green-50 border-green-300 dark:bg-green-950/30 dark:border-green-700" :
                    score === 0 ? "bg-card border-border" :
                    "bg-yellow-50 border-yellow-300 dark:bg-yellow-950/20 dark:border-yellow-800"
                  )}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold">J{num}</span>
                      <span className="text-muted-foreground">{dateStr}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {(["sport", "deficit", "fajr"] as const).map((k) => (
                        <button
                          key={k}
                          onClick={() => toggleChallenge(num, k)}
                          title={k === "sport" ? "Sport" : k === "deficit" ? "Déficit 600 kcal" : "Salat Al Fajr"}
                          className={cn("h-7 rounded text-[10px] font-bold uppercase transition-colors",
                            d[k]
                              ? "bg-green-500 text-white hover:bg-green-600"
                              : "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950/40 dark:text-red-300"
                          )}
                        >
                          {k === "sport" ? "S" : k === "deficit" ? "D" : "F"}
                        </button>
                      ))}
                    </div>
                    <div className="text-center text-xs font-semibold tabular-nums">{score}/3</div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
