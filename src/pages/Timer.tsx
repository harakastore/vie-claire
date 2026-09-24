import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Play, Square, Trash2, Timer as TimerIcon, BarChart3, Clock, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Session = {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  note: string | null;
};

const fmtHM = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h${String(m).padStart(2, "0")}`;
};
const fmtHMS = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};
const dayKey = (d: Date) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

export default function Timer() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [running, setRunning] = useState<Session | null>(null);
  const [now, setNow] = useState(Date.now());
  const [note, setNote] = useState("");
  const [from, setFrom] = useState(() => dayKey(addDays(new Date(), -6)));
  const [to, setTo] = useState(() => dayKey(new Date()));
  const tick = useRef<number | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("work_sessions")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(500);
      const rows = (data as Session[]) || [];
      setSessions(rows.filter((r) => r.ended_at));
      setRunning(rows.find((r) => !r.ended_at) || null);
    })();
  }, [user]);

  useEffect(() => {
    if (!running) {
      if (tick.current) window.clearInterval(tick.current);
      return;
    }
    setNow(Date.now());
    tick.current = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (tick.current) window.clearInterval(tick.current);
    };
  }, [running]);

  const start = async () => {
    if (!user || running) return;
    const { data, error } = await supabase
      .from("work_sessions")
      .insert({ user_id: user.id, started_at: new Date().toISOString(), note: note.trim() || null })
      .select()
      .single();
    if (error) return toast.error("Impossible de démarrer");
    setRunning(data as Session);
    setNote("");
    toast.success("Timer démarré");
  };

  const stop = async () => {
    if (!running) return;
    const end = new Date();
    const dur = Math.max(1, Math.round((end.getTime() - new Date(running.started_at).getTime()) / 1000));
    const closed: Session = { ...running, ended_at: end.toISOString(), duration_seconds: dur };
    setRunning(null);
    setSessions((p) => [closed, ...p]);
    await supabase
      .from("work_sessions")
      .update({ ended_at: closed.ended_at, duration_seconds: dur })
      .eq("id", running.id);
    toast.success(`Session enregistrée : ${fmtHM(dur)}`);
  };

  const remove = async (id: string) => {
    if (!window.confirm("Supprimer cette session ?")) return;
    setSessions((p) => p.filter((s) => s.id !== id));
    await supabase.from("work_sessions").delete().eq("id", id);
  };

  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ start: "", end: "", note: "" });
  const toLocal = (iso: string) => {
    const d = new Date(iso);
    return `${dayKey(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  const startEdit = (s: Session) => {
    setEditId(s.id);
    setEdit({ start: toLocal(s.started_at), end: s.ended_at ? toLocal(s.ended_at) : "", note: s.note || "" });
  };
  const saveEdit = async () => {
    if (!editId) return;
    const st = new Date(edit.start);
    const en = new Date(edit.end);
    if (isNaN(st.getTime()) || isNaN(en.getTime()) || en <= st) return toast.error("La fin doit être après le début");
    const patch = {
      started_at: st.toISOString(),
      ended_at: en.toISOString(),
      duration_seconds: Math.round((en.getTime() - st.getTime()) / 1000),
      note: edit.note.trim() || null,
    };
    setSessions((p) => p.map((s) => (s.id === editId ? { ...s, ...patch } : s)));
    const id = editId;
    setEditId(null);
    const { error } = await supabase.from("work_sessions").update(patch).eq("id", id);
    if (error) toast.error("Erreur d'enregistrement");
    else toast.success("Session modifiée");
  };

  const liveSec = running ? Math.max(0, Math.round((now - new Date(running.started_at).getTime()) / 1000)) : 0;

  const todayTotal = useMemo(() => {
    const k = dayKey(new Date());
    return sessions.filter((s) => dayKey(new Date(s.started_at)) === k).reduce((a, s) => a + (s.duration_seconds || 0), 0) + liveSec;
  }, [sessions, liveSec]);

  const filtered = useMemo(
    () => sessions.filter((s) => {
      const k = dayKey(new Date(s.started_at));
      return k >= from && k <= to;
    }),
    [sessions, from, to]
  );

  const days = useMemo(() => {
    const out: { key: string; label: string; sec: number }[] = [];
    const start = new Date(`${from}T00:00:00`);
    const end = new Date(`${to}T00:00:00`);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return out;
    for (let d = new Date(start); d <= end && out.length < 92; d = addDays(d, 1)) {
      const k = dayKey(d);
      const sec =
        filtered.filter((s) => dayKey(new Date(s.started_at)) === k).reduce((a, s) => a + (s.duration_seconds || 0), 0) +
        (k === dayKey(new Date()) ? liveSec : 0);
      out.push({ key: k, label: `${DAY_LABELS[d.getDay()]} ${d.getDate()}`, sec });
    }
    return out;
  }, [filtered, from, to, liveSec]);

  const totalSec = days.reduce((a, d) => a + d.sec, 0);
  const activeDays = days.filter((d) => d.sec > 0).length;
  const avgAll = days.length ? totalSec / days.length : 0;
  const avgActive = activeDays ? totalSec / activeDays : 0;
  const best = days.reduce((a, d) => (d.sec > a.sec ? d : a), { key: "", label: "-", sec: 0 });
  const maxSec = Math.max(1, ...days.map((d) => d.sec));

  const preset = (n: number) => {
    setFrom(dayKey(addDays(new Date(), -(n - 1))));
    setTo(dayKey(new Date()));
  };

  return (
    <div className="space-y-6 w-full">
      <PageHeader title="Timer de travail" description="Chronomètre tes sessions et suis tes heures travaillées par jour" />

      <Card className="border-2 overflow-hidden">
        <div className="bg-gradient-to-r from-primary/15 via-primary/5 to-transparent px-5 py-6 flex flex-wrap items-center gap-6">
          <div className="flex-1 min-w-[220px]">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">
              {running ? "En cours" : "Prêt à démarrer"}
            </p>
            <p className={cn("text-5xl font-black tabular-nums tracking-tight", running ? "text-primary" : "text-foreground/70")}>
              {fmtHMS(liveSec)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Aujourd'hui : <span className="font-bold text-foreground">{fmtHM(todayTotal)}</span>
            </p>
          </div>
          <div className="flex flex-col gap-2 min-w-[220px]">
            {!running && (
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Sur quoi tu travailles ? (optionnel)" className="h-9 text-sm" />
            )}
            {running ? (
              <Button size="lg" variant="destructive" onClick={stop} className="font-bold">
                <Square className="h-4 w-4 mr-2" /> Stopper
              </Button>
            ) : (
              <Button size="lg" onClick={start} className="font-bold">
                <Play className="h-4 w-4 mr-2" /> Démarrer
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card className="border-2">
        <CardHeader className="pb-3 flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-primary" /> Dashboard
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { l: "7j", n: 7 },
              { l: "14j", n: 14 },
              { l: "30j", n: 30 },
            ].map((p) => (
              <Button key={p.l} size="sm" variant="outline" className="h-8 px-3 text-xs" onClick={() => preset(p.n)}>
                {p.l}
              </Button>
            ))}
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-[140px] text-xs" />
            <span className="text-xs text-muted-foreground">→</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-[140px] text-xs" />
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Total période", value: fmtHM(totalSec) },
              { label: "Moyenne / jour", value: fmtHM(Math.round(avgAll)) },
              { label: "Moyenne jours travaillés", value: fmtHM(Math.round(avgActive)) },
              { label: "Meilleur jour", value: `${fmtHM(best.sec)} · ${best.label}` },
            ].map((k) => (
              <div key={k.label} className="rounded-xl border-2 bg-card px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{k.label}</p>
                <p className="text-lg font-black tabular-nums">{k.value}</p>
              </div>
            ))}
          </div>

          {days.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Choisis une plage de dates valide.</p>
          ) : (
            <div className="flex items-end gap-1.5 h-44 overflow-x-auto pb-1">
              {days.map((d) => (
                <div key={d.key} className="flex flex-col items-center gap-1 min-w-[34px] flex-1">
                  <span className="text-[9px] font-bold tabular-nums text-muted-foreground">{d.sec ? fmtHM(d.sec) : ""}</span>
                  <div
                    className={cn("w-full rounded-t-md transition-all", d.sec ? "bg-primary" : "bg-muted")}
                    style={{ height: `${Math.max(d.sec ? 6 : 3, (d.sec / maxSec) * 120)}px` }}
                    title={`${d.label} — ${fmtHM(d.sec)}`}
                  />
                  <span className="text-[9px] text-muted-foreground whitespace-nowrap">{d.label}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TimerIcon className="h-4 w-4 text-primary" /> Sessions ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {filtered.length === 0 && <p className="text-xs text-muted-foreground italic">Aucune session sur cette période.</p>}
          {filtered.map((s) => {
            const st = new Date(s.started_at);
            const en = s.ended_at ? new Date(s.ended_at) : null;
            if (editId === s.id) {
              return (
                <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-lg border-2 border-primary/50 bg-primary/5 px-3 py-2">
                  <Input type="datetime-local" value={edit.start} onChange={(e) => setEdit({ ...edit, start: e.target.value })} className="h-8 w-[190px] text-xs" />
                  <span className="text-xs">→</span>
                  <Input type="datetime-local" value={edit.end} onChange={(e) => setEdit({ ...edit, end: e.target.value })} className="h-8 w-[190px] text-xs" />
                  <Input value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} placeholder="Tâche" className="h-8 flex-1 min-w-[140px] text-xs" />
                  <Button size="sm" className="h-8" onClick={saveEdit}><Check className="h-3.5 w-3.5 mr-1" /> OK</Button>
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditId(null)}><X className="h-3.5 w-3.5" /></Button>
                </div>
              );
            }
            return (
              <div key={s.id} className="group flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs font-semibold tabular-nums shrink-0">
                  {DAY_LABELS[st.getDay()]} {st.toLocaleDateString("fr-FR")}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                  {st.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  {en ? ` → ${en.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : ""}
                </span>
                <span className="text-sm truncate flex-1">{s.note || ""}</span>
                <span className="text-sm font-black tabular-nums text-primary shrink-0">{fmtHM(s.duration_seconds || 0)}</span>
                <button onClick={() => startEdit(s)} title="Modifier" className="opacity-50 group-hover:opacity-100 text-muted-foreground hover:text-foreground shrink-0">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => remove(s.id)} title="Supprimer" className="opacity-50 group-hover:opacity-100 text-destructive shrink-0">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
