import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export type BRTask = {
  id: string; title: string; block_key: string; scheduled_time: string | null;
  days_of_week: number[] | null; color: string; active: boolean; sort_order: number; habit_id?: string | null;
};
export type DHabit = { id: string; title: string; category: string | null; days_of_week: number[] | null };

export const BR_COLORS: Record<string, { label: string; hue: string }> = {
  violet: { label: "Mauve", hue: "270 70% 55%" },
  blue: { label: "Bleu", hue: "215 80% 52%" },
  teal: { label: "Turquoise", hue: "175 65% 38%" },
  pink: { label: "Rose", hue: "330 75% 55%" },
  amber: { label: "Ambre", hue: "38 90% 48%" },
};
const DAYS = [
  { v: 1, l: "L" }, { v: 2, l: "M" }, { v: 3, l: "M" }, { v: 4, l: "J" }, { v: 5, l: "V" }, { v: 6, l: "S" }, { v: 0, l: "D" },
];

const tbl = () => supabase.from("block_recurring_tasks" as any) as any;
const logs = () => supabase.from("block_recurring_logs" as any) as any;

export function useBlockRecurring() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<BRTask[]>([]);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [habits, setHabits] = useState<DHabit[]>([]);
  const [hDone, setHDone] = useState<Map<string, { id: string; completed: boolean }>>(new Map());

  useEffect(() => {
    if (!user) return;
    (async () => {
      const since = new Date(); since.setDate(since.getDate() - 60);
      const sinceStr = since.toISOString().slice(0, 10);
      const [t, l, h, hl] = await Promise.all([
        tbl().select("*").order("scheduled_time", { ascending: true, nullsFirst: false }).order("sort_order"),
        logs().select("task_id, day_date").gte("day_date", sinceStr),
        (supabase.from("daily_habits" as any) as any).select("id, title, category, days_of_week").eq("active", true).order("sort_order"),
        (supabase.from("daily_habit_logs" as any) as any).select("id, habit_id, day_date, completed").gte("day_date", sinceStr),
      ]);
      setHabits((h.data as DHabit[]) || []);
      setHDone(new Map(((hl.data as any[]) || []).map((r) => [`${r.habit_id}_${r.day_date}`, { id: r.id, completed: r.completed }])));
      setTasks((t.data as BRTask[]) || []);
      setDone(new Set(((l.data as any[]) || []).map((r) => `${r.task_id}_${r.day_date}`)));
    })();
  }, [user]);

  const forBlock = useCallback((dateStr: string, blockKey: string) => {
    const dow = new Date(`${dateStr}T12:00:00`).getDay();
    return tasks.filter((t) => t.active && t.block_key === blockKey && (!t.days_of_week || t.days_of_week.length === 0 || t.days_of_week.includes(dow)));
  }, [tasks]);

  const habitOf = (id: string) => tasks.find((t) => t.id === id)?.habit_id || null;
  const isDone = (id: string, dateStr: string) => {
    const hid = habitOf(id);
    if (hid) return !!hDone.get(`${hid}_${dateStr}`)?.completed;
    return done.has(`${id}_${dateStr}`);
  };

  const toggle = async (id: string, dateStr: string) => {
    if (!user) return;
    const hid = habitOf(id);
    if (hid) {
      const hk = `${hid}_${dateStr}`;
      const ex = hDone.get(hk);
      const nv = !ex?.completed;
      setHDone((p) => { const n = new Map(p); n.set(hk, { id: ex?.id || "tmp", completed: nv }); return n; });
      if (ex && ex.id !== "tmp") await (supabase.from("daily_habit_logs" as any) as any).update({ completed: nv }).eq("id", ex.id);
      else {
        const { data } = await (supabase.from("daily_habit_logs" as any) as any).insert({ user_id: user.id, habit_id: hid, day_date: dateStr, completed: true }).select().single();
        if (data) setHDone((p) => { const n = new Map(p); n.set(hk, { id: (data as any).id, completed: (data as any).completed }); return n; });
      }
      return;
    }
    const k = `${id}_${dateStr}`;
    const was = done.has(k);
    setDone((p) => { const n = new Set(p); was ? n.delete(k) : n.add(k); return n; });
    if (was) await logs().delete().eq("task_id", id).eq("day_date", dateStr);
    else await logs().insert({ user_id: user.id, task_id: id, day_date: dateStr });
  };

  const add = async (v: { title: string; block_key: string; scheduled_time: string | null; days_of_week: number[] | null; color: string; habit_id?: string | null }) => {
    if (!user) return;
    const { data } = await tbl().insert({ ...v, user_id: user.id }).select().single();
    if (data) setTasks((p) => [...p, data as BRTask]);
  };
  const update = async (id: string, patch: Partial<BRTask>) => {
    setTasks((p) => p.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    await tbl().update(patch).eq("id", id);
  };
  const remove = async (id: string) => {
    setTasks((p) => p.filter((t) => t.id !== id));
    await tbl().delete().eq("id", id);
  };

  return { tasks, habits, forBlock, isDone, toggle, add, update, remove };
}

export type BlockRecurringApi = ReturnType<typeof useBlockRecurring>;

function DayPicker({ value, onChange }: { value: number[] | null; onChange: (v: number[] | null) => void }) {
  const all = !value || value.length === 0;
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <button type="button" onClick={() => onChange(null)} className={cn("h-6 px-2 rounded-md text-[10px] font-bold border", all ? "bg-primary text-primary-foreground border-primary" : "bg-background")}>Tous</button>
      {DAYS.map((d) => {
        const on = !all && value!.includes(d.v);
        return (
          <button key={d.v} type="button"
            onClick={() => {
              const cur = all ? [] : [...value!];
              const next = on ? cur.filter((x) => x !== d.v) : [...cur, d.v];
              onChange(next.length === 0 || next.length === 7 ? null : next);
            }}
            className={cn("h-6 w-6 rounded-md text-[10px] font-bold border", on ? "bg-primary text-primary-foreground border-primary" : "bg-background")}
          >{d.l}</button>
        );
      })}
    </div>
  );
}

type FormV = { title: string; scheduled_time: string | null; days_of_week: number[] | null; color: string; habit_id?: string | null };
function TaskForm({ initial, onSubmit, submitLabel, habits }: {
  initial: FormV; onSubmit: (v: FormV) => void; submitLabel: string; habits: DHabit[];
}) {
  const [v, setV] = useState<FormV>(initial);
  return (
    <div className="space-y-2.5">
      {habits.length > 0 && (
        <div>
          <p className="text-[11px] text-muted-foreground mb-1">Lier à une tâche Discipline</p>
          <div className="flex flex-wrap gap-1 max-h-28 overflow-auto">
            {habits.map((h) => (
              <button key={h.id} type="button"
                onClick={() => setV(v.habit_id === h.id ? { ...v, habit_id: null } : { ...v, habit_id: h.id, title: h.title, days_of_week: h.days_of_week && h.days_of_week.length ? h.days_of_week : null })}
                className={cn("px-2 h-6 rounded-md text-[11px] font-semibold border", v.habit_id === h.id ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted")}
              >{h.title}</button>
            ))}
          </div>
        </div>
      )}
      <Input autoFocus placeholder="Ex : Apprentissage anglais" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} className="h-8 text-sm" />
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground w-12">Heure</span>
        <input type="time" value={v.scheduled_time?.slice(0, 5) || ""} onChange={(e) => setV({ ...v, scheduled_time: e.target.value || null })} className="h-7 text-xs px-1.5 rounded border border-input bg-background tabular-nums" />
      </div>
      <div className="flex items-start gap-2">
        <span className="text-[11px] text-muted-foreground w-12 pt-1">Jours</span>
        <DayPicker value={v.days_of_week} onChange={(d) => setV({ ...v, days_of_week: d })} />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground w-12">Couleur</span>
        <div className="flex gap-1.5">
          {Object.entries(BR_COLORS).map(([k, c]) => (
            <button key={k} type="button" title={c.label} onClick={() => setV({ ...v, color: k })}
              className={cn("h-6 w-6 rounded-full border-2", v.color === k ? "border-foreground scale-110" : "border-transparent")}
              style={{ backgroundColor: `hsl(${c.hue})` }} />
          ))}
        </div>
      </div>
      <Button size="sm" className="w-full h-8" disabled={!v.title.trim()} onClick={() => onSubmit({ ...v, title: v.title.trim() })}>{submitLabel}</Button>
    </div>
  );
}

export function BlockRecurringList({ api, dateStr, blockKey }: { api: BlockRecurringApi; dateStr: string; blockKey: string }) {
  const items = api.forBlock(dateStr, blockKey);
  const [openAdd, setOpenAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      {items.map((t) => {
        const c = BR_COLORS[t.color] || BR_COLORS.violet;
        const d = api.isDone(t.id, dateStr);
        return (
          <div key={t.id} className="group flex items-center gap-2 rounded-md px-2 py-1.5 border-l-4"
            style={{ backgroundColor: `hsl(${c.hue} / ${d ? 0.08 : 0.16})`, borderLeftColor: `hsl(${c.hue})` }}>
            <Checkbox checked={d} onCheckedChange={() => api.toggle(t.id, dateStr)} className="h-4 w-4" />
            {t.scheduled_time && <span className="text-[10px] font-black tabular-nums shrink-0" style={{ color: `hsl(${c.hue})` }}>{t.scheduled_time.slice(0, 5)}</span>}
            <span className={cn("text-sm font-semibold flex-1 leading-snug", d && "line-through opacity-60")}>{t.title}</span>
            {t.habit_id && <span className="text-[9px] font-bold uppercase px-1 rounded bg-primary/15 text-primary shrink-0">Discipline</span>}
            <Popover open={editId === t.id} onOpenChange={(o) => setEditId(o ? t.id : null)}>
              <PopoverTrigger asChild>
                <button title="Tâche fixe — modifier" className="shrink-0 opacity-60 hover:opacity-100"><Lock className="h-3 w-3" style={{ color: `hsl(${c.hue})` }} /></button>
              </PopoverTrigger>
              <PopoverContent className="w-72">
                <p className="text-xs font-bold mb-2">Modifier la tâche fixe</p>
                <TaskForm habits={api.habits} initial={{ title: t.title, scheduled_time: t.scheduled_time, days_of_week: t.days_of_week, color: t.color, habit_id: t.habit_id ?? null }} submitLabel="Enregistrer"
                  onSubmit={(v) => { api.update(t.id, v); setEditId(null); }} />
                <Button size="sm" variant="ghost" className="w-full h-7 mt-1 text-destructive" onClick={() => { api.remove(t.id); setEditId(null); }}>
                  <Trash2 className="h-3 w-3 mr-1" /> Supprimer (tous les jours)
                </Button>
              </PopoverContent>
            </Popover>
          </div>
        );
      })}
      <Popover open={openAdd} onOpenChange={setOpenAdd}>
        <PopoverTrigger asChild>
          <button className="w-full flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground px-1 py-0.5">
            <Plus className="h-3 w-3" /> <Lock className="h-2.5 w-2.5" /> Tâche fixe récurrente
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72">
          <p className="text-xs font-bold mb-2">Nouvelle tâche fixe dans ce bloc</p>
          <TaskForm habits={api.habits} initial={{ title: "", scheduled_time: null, days_of_week: null, color: "violet", habit_id: null }} submitLabel="Bloquer dans ce bloc"
            onSubmit={(v) => { api.add({ ...v, block_key: blockKey }); setOpenAdd(false); }} />
        </PopoverContent>
      </Popover>
    </div>
  );
}
