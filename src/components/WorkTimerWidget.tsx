import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Play, Square, Timer as TimerIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TimerTaskPicker } from "@/components/tracking/TimerTaskPicker";
import { Button } from "@/components/ui/button";

type Session = { id: string; started_at: string; ended_at: string | null; duration_seconds: number | null; note: string | null };

const pad = (n: number) => String(n).padStart(2, "0");
const fmtHMS = (s: number) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
const fmtHM = (s: number) => `${Math.floor(s / 3600)}h${pad(Math.floor((s % 3600) / 60))}`;

export function WorkTimerWidget() {
  const { user } = useAuth();
  const [running, setRunning] = useState<Session | null>(null);
  const [todayDone, setTodayDone] = useState(0);
  const [note, setNote] = useState("");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!user) return;
    (async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const { data } = await supabase.from("work_sessions").select("*")
        .or(`started_at.gte.${start.toISOString()},ended_at.is.null`).order("started_at", { ascending: false });
      const rows = (data as Session[]) || [];
      setRunning(rows.find((r) => !r.ended_at) || null);
      setTodayDone(rows.filter((r) => r.ended_at).reduce((a, r) => a + (r.duration_seconds || 0), 0));
    })();
  }, [user]);

  useEffect(() => {
    if (!running) return;
    const i = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(i);
  }, [running]);

  const live = running ? Math.max(0, Math.round((now - new Date(running.started_at).getTime()) / 1000)) : 0;

  const start = async () => {
    if (!user || running) return;
    const optimistic: Session = { id: "tmp", started_at: new Date().toISOString(), ended_at: null, duration_seconds: null, note: note.trim() || null };
    setRunning(optimistic); setNow(Date.now());
    const { data, error } = await supabase.from("work_sessions")
      .insert({ user_id: user.id, started_at: optimistic.started_at, note: optimistic.note }).select().single();
    if (error) { setRunning(null); return toast.error("Impossible de démarrer"); }
    setRunning(data as Session);
    setNote("");
  };

  const stop = async () => {
    if (!running || running.id === "tmp") return;
    const end = new Date();
    const dur = Math.max(1, Math.round((end.getTime() - new Date(running.started_at).getTime()) / 1000));
    const id = running.id;
    setRunning(null);
    setTodayDone((t) => t + dur);
    const previous = running;
    const { error } = await supabase.from("work_sessions").update({ ended_at: end.toISOString(), duration_seconds: dur }).eq("id", id);
    if (error) { setRunning(previous); setTodayDone(t => t - dur); return toast.error("Enregistrement impossible"); }
    toast.success(`Session enregistrée : ${fmtHM(dur)}`);
  };

  return (
    <div className={cn(
      "flex flex-wrap items-center gap-2 rounded-lg border px-2.5 py-1.5 bg-background text-foreground transition-all",
      running ? "border-primary shadow-md" : "border-border"
    )}>
      <div className="flex flex-col leading-none min-w-[92px]">
        <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest opacity-85">
          {running ? <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> : <TimerIcon className="h-2.5 w-2.5" />}
          {running ? "En cours" : "Timer"}
        </span>
        <span className="text-xl font-black tabular-nums tracking-tight">{fmtHMS(live)}</span>
        <span className="text-[9px] opacity-80 font-medium">Aujourd'hui {fmtHM(todayDone + live)}</span>
      </div>
      {running ? (
        <span className="max-w-[160px] truncate text-xs font-semibold opacity-95" title={running.note || ""}>{running.note || "Travail"}</span>
      ) : (
        <TimerTaskPicker value={note} onChange={setNote} compact />
      )}
      <Button size="icon" variant={running ? "destructive" : "default"}
        disabled={running?.id === "tmp"}
        onClick={running ? stop : start}
        className={cn(
          "h-9 w-9 shrink-0 rounded-xl flex items-center justify-center shadow-md transition-transform hover:scale-105",
          running ? "bg-destructive text-destructive-foreground" : "bg-background text-primary"
        )}
        title={running ? "Stopper" : "Démarrer"}
      >
        {running ? <Square className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
      </Button>
    </div>
  );
}
