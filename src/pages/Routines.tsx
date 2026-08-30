import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EditableText } from "@/components/EditableText";
import { Plus, Trash2, UtensilsCrossed, Clock, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SLOTS = [
  { key: "ftour", label: "Ftour / Petit-déjeuner", color: "#f59e0b" },
  { key: "collation_matin", label: "Collation (ftour → déjeuner)", color: "#10b981" },
  { key: "dejeuner", label: "Déjeuner", color: "#3b82f6" },
  { key: "collation_soir", label: "Collation (déjeuner → dîner)", color: "#8b5cf6" },
  { key: "diner", label: "Dîner", color: "#ec4899" },
];

type Meal = {
  id: string;
  slot: string;
  name: string;
  kcal: number | null;
  protein_g: number | null;
  sort_order: number;
};

type Slot = {
  id: string;
  label: string;
  start_time: string | null;
  end_time: string | null;
  sort_order: number;
};

export default function Routines() {
  const { user } = useAuth();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [schedule, setSchedule] = useState<Slot[]>([]);
  const [newMeal, setNewMeal] = useState<Record<string, { name: string; kcal: string; protein: string }>>({});
  const [newSlot, setNewSlot] = useState({ label: "", start: "", end: "" });
  const [calcing, setCalcing] = useState<string | null>(null);

  const analyze = async (text: string) => {
    const { data, error } = await supabase.functions.invoke("parse-meal", { body: { text, type: "meal" } });
    if (error || !data || (data as any).error) throw new Error("calcul impossible");
    return data as { name: string; kcal: number; protein_g: number };
  };

  const calcDraft = async (slot: string) => {
    const draft = newMeal[slot] || { name: "", kcal: "", protein: "" };
    if (!draft.name.trim()) return;
    setCalcing(slot);
    try {
      const r = await analyze(draft.name.trim());
      setNewMeal((p) => ({ ...p, [slot]: { name: r.name || draft.name, kcal: String(r.kcal), protein: String(r.protein_g) } }));
    } catch {
      toast.error("Calcul automatique indisponible");
    } finally {
      setCalcing(null);
    }
  };

  const calcExisting = async (m: Meal) => {
    setCalcing(m.id);
    try {
      const r = await analyze(m.name);
      await updateMeal(m.id, { kcal: r.kcal, protein_g: r.protein_g });
    } catch {
      toast.error("Calcul automatique indisponible");
    } finally {
      setCalcing(null);
    }
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [m, s] = await Promise.all([
        supabase.from("routine_meals").select("*").order("sort_order"),
        supabase.from("routine_schedule").select("*").order("sort_order"),
      ]);
      setMeals((m.data as Meal[]) || []);
      setSchedule((s.data as Slot[]) || []);
    })();
  }, [user]);

  const addMeal = async (slot: string) => {
    const draft = newMeal[slot] || { name: "", kcal: "", protein: "" };
    let name = draft.name.trim();
    if (!name || !user) return;
    let kcal = draft.kcal ? Number(draft.kcal) : null;
    let protein: number | null = draft.protein ? Number(draft.protein) : null;
    if (kcal === null && protein === null) {
      setCalcing(slot);
      try {
        const r = await analyze(name);
        name = r.name || name;
        kcal = r.kcal;
        protein = r.protein_g;
      } catch {
        toast.error("Calcul automatique indisponible");
      } finally {
        setCalcing(null);
      }
    }
    const row = {
      user_id: user.id,
      slot,
      name,
      kcal,
      protein_g: protein,
      sort_order: meals.filter((x) => x.slot === slot).length,
    };
    setNewMeal((p) => ({ ...p, [slot]: { name: "", kcal: "", protein: "" } }));
    const { data } = await supabase.from("routine_meals").insert(row).select().single();
    if (data) setMeals((p) => [...p, data as Meal]);
  };

  const updateMeal = async (id: string, patch: Partial<Meal>) => {
    setMeals((p) => p.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    await supabase.from("routine_meals").update(patch).eq("id", id);
  };

  const removeMeal = async (id: string) => {
    setMeals((p) => p.filter((m) => m.id !== id));
    await supabase.from("routine_meals").delete().eq("id", id);
  };

  const addSlot = async () => {
    const label = newSlot.label.trim();
    if (!label || !user) return;
    const row = {
      user_id: user.id,
      label,
      start_time: newSlot.start || null,
      end_time: newSlot.end || null,
      sort_order: schedule.length,
    };
    setNewSlot({ label: "", start: "", end: "" });
    const { data } = await supabase.from("routine_schedule").insert(row).select().single();
    if (data) setSchedule((p) => [...p, data as Slot]);
  };

  const updateSlot = async (id: string, patch: Partial<Slot>) => {
    setSchedule((p) => p.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    await supabase.from("routine_schedule").update(patch).eq("id", id);
  };

  const removeSlot = async (id: string) => {
    setSchedule((p) => p.filter((s) => s.id !== id));
    await supabase.from("routine_schedule").delete().eq("id", id);
  };

  return (
    <div className="space-y-6 w-full">
      <PageHeader title="Routines" description="Routine de nutrition et routine de travail — tout est modifiable" />

      <Card className="border-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <UtensilsCrossed className="h-4 w-4 text-primary" /> Routine nutrition
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {SLOTS.map((s) => {
            const list = meals.filter((m) => m.slot === s.key);
            const draft = newMeal[s.key] || { name: "", kcal: "", protein: "" };
            const totalKcal = list.reduce((a, m) => a + (Number(m.kcal) || 0), 0);
            const totalProt = list.reduce((a, m) => a + (Number(m.protein_g) || 0), 0);
            return (
              <div key={s.key} className="rounded-xl border-2 bg-card overflow-hidden flex flex-col" style={{ borderTopColor: s.color, borderTopWidth: 4 }}>
                <div className="px-3 py-2 flex items-center justify-between" style={{ backgroundColor: `${s.color}12` }}>
                  <span className="text-xs font-black uppercase tracking-wide" style={{ color: s.color }}>{s.label}</span>
                  <span className="text-[10px] font-bold tabular-nums" style={{ color: s.color }}>
                    {totalKcal} kcal · {totalProt}g P
                  </span>
                </div>
                <div className="px-3 py-2 space-y-1 flex-1">
                  {list.length === 0 && <p className="text-[11px] text-muted-foreground italic py-1">Aucun aliment</p>}
                  {list.map((m) => (
                    <div key={m.id} className="group flex items-center gap-2 py-1 px-1.5 rounded hover:bg-muted/60">
                      <EditableText value={m.name} onSave={(v) => updateMeal(m.id, { name: v })} className="text-sm font-medium flex-1" />
                      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                        {m.kcal ? `${m.kcal} kcal` : ""}{m.protein_g ? ` · ${m.protein_g}g` : ""}
                      </span>
                      <button onClick={() => removeMeal(m.id)} className="opacity-0 group-hover:opacity-100 text-destructive shrink-0">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="px-2 pb-2 space-y-1">
                  <Input
                    value={draft.name}
                    onChange={(e) => setNewMeal((p) => ({ ...p, [s.key]: { ...draft, name: e.target.value } }))}
                    onKeyDown={(e) => { if (e.key === "Enter") addMeal(s.key); }}
                    placeholder="Aliment / repas…"
                    className="h-8 text-xs"
                  />
                  <div className="flex gap-1">
                    <Input type="number" value={draft.kcal} onChange={(e) => setNewMeal((p) => ({ ...p, [s.key]: { ...draft, kcal: e.target.value } }))} placeholder="kcal" className="h-8 text-xs" />
                    <Input type="number" value={draft.protein} onChange={(e) => setNewMeal((p) => ({ ...p, [s.key]: { ...draft, protein: e.target.value } }))} placeholder="prot. g" className="h-8 text-xs" />
                    <Button size="sm" className="h-8 px-2" onClick={() => addMeal(s.key)} disabled={!draft.name.trim()}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-primary" /> Routine de travail & journée
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {schedule.length === 0 && (
            <p className="text-xs text-muted-foreground italic">
              Ajoutez vos horaires : début du travail, blocs, sport, sortie du bureau, heure de coucher…
            </p>
          )}
          {schedule.map((s) => (
            <div key={s.id} className={cn("group flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2")}>
              <EditableText value={s.label} onSave={(v) => updateSlot(s.id, { label: v })} className="text-sm font-semibold flex-1 min-w-[140px]" />
              <Input type="time" value={s.start_time?.slice(0, 5) || ""} onChange={(e) => updateSlot(s.id, { start_time: e.target.value || null })} className="h-8 w-[110px] text-xs" />
              <span className="text-xs text-muted-foreground">→</span>
              <Input type="time" value={s.end_time?.slice(0, 5) || ""} onChange={(e) => updateSlot(s.id, { end_time: e.target.value || null })} className="h-8 w-[110px] text-xs" />
              <button onClick={() => removeSlot(s.id)} className="opacity-0 group-hover:opacity-100 text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2 rounded-lg border-2 border-dashed px-3 py-2">
            <Input value={newSlot.label} onChange={(e) => setNewSlot((p) => ({ ...p, label: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") addSlot(); }}
              placeholder="Ex. Début du travail, Bloc 1, Sport, Sortie bureau, Coucher…" className="h-8 text-xs flex-1 min-w-[180px]" />
            <Input type="time" value={newSlot.start} onChange={(e) => setNewSlot((p) => ({ ...p, start: e.target.value }))} className="h-8 w-[110px] text-xs" />
            <Input type="time" value={newSlot.end} onChange={(e) => setNewSlot((p) => ({ ...p, end: e.target.value }))} className="h-8 w-[110px] text-xs" />
            <Button size="sm" className="h-8" onClick={addSlot} disabled={!newSlot.label.trim()}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
