import { useEffect, useMemo, useState } from "react";
import { format, addDays, parseISO, differenceInCalendarDays } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Flame, Trophy, RotateCcw, Settings2, Save } from "lucide-react";
import heroPhoto from "@/assets/discipline-hero.png";

type ChallengeDay = { day_number: number; sport: boolean; deficit: boolean; fajr: boolean };
type Config = {
  title: string;
  start_date: string;
  days_count: number;
  obj1_label: string;
  obj2_label: string;
  obj3_label: string;
};

const DEFAULT_CONFIG: Config = {
  title: "Discipline Absolue",
  start_date: format(new Date(), "yyyy-MM-dd"),
  days_count: 15,
  obj1_label: "Déficit",
  obj2_label: "Sport",
  obj3_label: "Fajr",
};

export default function HighPerformance() {
  const { user } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");

  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [days, setDays] = useState<ChallengeDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<Config>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);

  const loadAll = async () => {
    if (!user) return;
    setLoading(true);
    const { data: cfgRow } = await supabase
      .from("hp_config" as any)
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    let cfg: Config = DEFAULT_CONFIG;
    if (cfgRow) {
      cfg = {
        title: (cfgRow as any).title,
        start_date: (cfgRow as any).start_date,
        days_count: (cfgRow as any).days_count,
        obj1_label: (cfgRow as any).obj1_label,
        obj2_label: (cfgRow as any).obj2_label,
        obj3_label: (cfgRow as any).obj3_label,
      };
    } else {
      // create default config
      await supabase.from("hp_config" as any).insert({ user_id: user.id, ...DEFAULT_CONFIG });
    }
    setConfig(cfg);

    const { data } = await supabase
      .from("hp_challenge")
      .select("*")
      .eq("user_id", user.id)
      .eq("challenge_start", cfg.start_date)
      .order("day_number", { ascending: true });

    const mapped = (data || [])
      .filter((c: any) => c.day_number <= cfg.days_count)
      .map((c: any) => ({ day_number: c.day_number, sport: c.sport, deficit: c.deficit, fajr: c.fajr }));
    setDays(mapped);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, [user]);

  const openEdit = () => {
    setDraft(config);
    setEditOpen(true);
  };

  const saveConfig = async () => {
    if (!user) return;
    if (!draft.title.trim() || !draft.start_date || draft.days_count < 1) {
      toast({ title: "Champs invalides", description: "Vérifie le titre, la date et la durée.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("hp_config" as any)
      .upsert({ user_id: user.id, ...draft, days_count: Number(draft.days_count) }, { onConflict: "user_id" });
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      setSaving(false);
      return;
    }
    toast({ title: "Challenge mis à jour" });
    setEditOpen(false);
    setSaving(false);
    await loadAll();
  };

  const reset = async () => {
    if (!user) return;
    await supabase.from("hp_challenge").delete().eq("user_id", user.id).eq("challenge_start", config.start_date);
    setDays([]);
    toast({ title: "Challenge réinitialisé" });
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
      { user_id: user.id, challenge_start: config.start_date, ...updated },
      { onConflict: "user_id,challenge_start,day_number" }
    );
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
  };

  const startDate = parseISO(config.start_date);
  const endDate = addDays(startDate, config.days_count - 1);

  const todayDayNum = useMemo(() => {
    const diff = differenceInCalendarDays(new Date(today), startDate) + 1;
    return diff >= 1 && diff <= config.days_count ? diff : null;
  }, [today, config.start_date, config.days_count]);

  const totalChecks = days.reduce((acc, d) => acc + (d.sport ? 1 : 0) + (d.deficit ? 1 : 0) + (d.fajr ? 1 : 0), 0);
  const max = config.days_count * 3;
  const pct = max > 0 ? Math.round((totalChecks / max) * 100) : 0;
  const perfectDays = days.filter(d => d.sport && d.deficit && d.fajr).length;
  const streak = useMemo(() => {
    let s = 0;
    for (let i = 1; i <= config.days_count; i++) {
      const d = days.find(x => x.day_number === i);
      if (d && d.sport && d.deficit && d.fajr) s++;
      else break;
    }
    return s;
  }, [days, config.days_count]);

  const OBJECTIVES = [
    { key: "deficit" as const, label: config.obj1_label },
    { key: "sport" as const, label: config.obj2_label },
    { key: "fajr" as const, label: config.obj3_label },
  ];

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
          <div className="flex items-start gap-5">
            <img
              src={heroPhoto}
              alt="Objectif physique"
              className="h-32 w-32 sm:h-40 sm:w-40 rounded-2xl object-cover ring-4 ring-white/40 shadow-2xl shrink-0"
            />
            <div>
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur rounded-full px-3 py-1 text-xs font-bold mb-2">
                🔥 CHALLENGE {config.days_count} JOURS
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight">{config.title}</h1>
              <p className="text-sm sm:text-base opacity-90 mt-2 max-w-xl">
                Du <span className="font-bold">{format(startDate, "EEEE d MMMM", { locale: fr })}</span> au <span className="font-bold">{format(endDate, "EEEE d MMMM yyyy", { locale: fr })}</span>
              </p>
              <p className="text-xs opacity-80 mt-1">Chaque jour : {OBJECTIVES.map(o => o.label).join(" · ")}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 min-w-[280px]">
            <div className="bg-white/15 backdrop-blur rounded-xl p-3 text-center">
              <Trophy className="h-4 w-4 mx-auto mb-1 text-yellow-300" />
              <p className="text-xl font-black tabular-nums">{pct}%</p>
              <p className="text-[10px] opacity-80 uppercase tracking-wider">Score</p>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-xl p-3 text-center">
              <p className="text-xl font-black tabular-nums">{perfectDays}/{config.days_count}</p>
              <p className="text-[10px] opacity-80 uppercase tracking-wider">Parfaits</p>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-xl p-3 text-center">
              <Flame className="h-4 w-4 mx-auto mb-1 text-orange-200" />
              <p className="text-xl font-black tabular-nums">{streak}</p>
              <p className="text-[10px] opacity-80 uppercase tracking-wider">Streak</p>
            </div>
          </div>
        </div>

        <div className="relative mt-5 h-3 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-yellow-300 to-white rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="relative flex items-center justify-between mt-2 text-xs opacity-90 flex-wrap gap-2">
          <span className="tabular-nums font-bold">{totalChecks}/{max} validations</span>
          {todayDayNum && <span className="font-bold">📍 Jour {todayDayNum} aujourd'hui</span>}
          <div className="flex items-center gap-3">
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogTrigger asChild>
                <button onClick={openEdit} className="inline-flex items-center gap-1 underline opacity-90 hover:opacity-100">
                  <Settings2 className="h-3 w-3" /> Modifier
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Personnaliser le challenge</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Titre</Label>
                    <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Date de début</Label>
                      <Input type="date" value={draft.start_date} onChange={(e) => setDraft({ ...draft, start_date: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Durée (jours)</Label>
                      <Input type="number" min={1} max={365} value={draft.days_count} onChange={(e) => setDraft({ ...draft, days_count: parseInt(e.target.value || "0") })} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Objectif 1</Label>
                    <Input value={draft.obj1_label} onChange={(e) => setDraft({ ...draft, obj1_label: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Objectif 2</Label>
                    <Input value={draft.obj2_label} onChange={(e) => setDraft({ ...draft, obj2_label: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Objectif 3</Label>
                    <Input value={draft.obj3_label} onChange={(e) => setDraft({ ...draft, obj3_label: e.target.value })} />
                  </div>
                  <p className="text-xs text-muted-foreground">⚠️ Changer la date de début affichera un nouveau suivi vierge (les cases existantes sont liées à l'ancienne date).</p>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditOpen(false)}>Annuler</Button>
                  <Button onClick={saveConfig} disabled={saving}><Save className="h-4 w-4 mr-1" />Enregistrer</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <button onClick={reset} className="inline-flex items-center gap-1 underline opacity-80 hover:opacity-100">
              <RotateCcw className="h-3 w-3" /> Réinitialiser
            </button>
          </div>
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
            {Array.from({ length: config.days_count }, (_, i) => {
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
                    {OBJECTIVES.map(({ key, label }) => (
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
                        <span className="truncate">{label}</span>
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
