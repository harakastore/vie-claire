import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, TrendingUp, Trophy } from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { format } from "date-fns";

type Discipline = { id: string; user_id: string; name: string; unit: string; type: string; notes: string | null };
type Record_ = { id: string; user_id: string; discipline_id: string; value: number; recorded_at: string; note: string | null };

const TYPES = [
  { v: "max", label: "Force / Max (plus = mieux)" },
  { v: "time", label: "Temps (moins = mieux)" },
  { v: "distance", label: "Distance (plus = mieux)" },
];

export default function SportPerf() {
  const { user } = useAuth();
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [records, setRecords] = useState<Record_[]>([]);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("kg");
  const [type, setType] = useState("max");

  const [newValues, setNewValues] = useState<Record<string, string>>({});
  const [newDates, setNewDates] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [d, r] = await Promise.all([
        (supabase.from as any)("sport_disciplines").select("*").order("created_at", { ascending: true }),
        (supabase.from as any)("sport_records").select("*").order("recorded_at", { ascending: true }),
      ]);
      setDisciplines((d.data as any) || []);
      setRecords((r.data as any) || []);
    })();
  }, [user]);

  const addDiscipline = async () => {
    if (!user || !name.trim()) return;
    const payload = { user_id: user.id, name: name.trim(), unit: unit.trim() || "kg", type };
    const { data, error } = await (supabase.from as any)("sport_disciplines").insert(payload).select().single();
    if (error) { toast.error(error.message); return; }
    setDisciplines((p) => [...p, data as any]);
    setName(""); setUnit("kg"); setType("max");
    toast.success("Discipline ajoutée");
  };

  const removeDiscipline = async (id: string) => {
    if (!confirm("Supprimer cette discipline et tout son historique ?")) return;
    const prev = disciplines;
    setDisciplines((p) => p.filter((x) => x.id !== id));
    const { error } = await (supabase.from as any)("sport_disciplines").delete().eq("id", id);
    if (error) { setDisciplines(prev); toast.error(error.message); }
  };

  const addRecord = async (d: Discipline) => {
    if (!user) return;
    const raw = newValues[d.id];
    if (!raw) return;
    const value = parseFloat(raw.replace(",", "."));
    if (isNaN(value)) { toast.error("Valeur invalide"); return; }
    const recorded_at = newDates[d.id] || format(new Date(), "yyyy-MM-dd");
    const payload = { user_id: user.id, discipline_id: d.id, value, recorded_at };
    const { data, error } = await (supabase.from as any)("sport_records").insert(payload).select().single();
    if (error) { toast.error(error.message); return; }
    setRecords((p) => [...p, data as any]);
    setNewValues((p) => ({ ...p, [d.id]: "" }));
    const best = bestFor(d, [...records, data as any]);
    if (best && best.id === (data as any).id) toast.success("🏆 Nouveau record !");
    else toast.success("Performance enregistrée");
  };

  const removeRecord = async (id: string) => {
    const prev = records;
    setRecords((p) => p.filter((x) => x.id !== id));
    const { error } = await (supabase.from as any)("sport_records").delete().eq("id", id);
    if (error) { setRecords(prev); toast.error(error.message); }
  };

  const bestFor = (d: Discipline, rs: Record_[]) => {
    const list = rs.filter((r) => r.discipline_id === d.id);
    if (!list.length) return null;
    return d.type === "time"
      ? list.reduce((a, b) => (Number(a.value) <= Number(b.value) ? a : b))
      : list.reduce((a, b) => (Number(a.value) >= Number(b.value) ? a : b));
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      <PageHeader title="Performances Sport" description="Suis tes records par discipline et visualise ta progression" />

      <Card className="mb-6">
        <CardHeader><CardTitle className="text-base">Ajouter une discipline</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <Input placeholder="ex: Développé couché, Footing 5km..." value={name} onChange={(e) => setName(e.target.value)} className="md:col-span-2" />
          <Input placeholder="Unité (kg, min, km...)" value={unit} onChange={(e) => setUnit(e.target.value)} />
          <div className="flex gap-2">
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={addDiscipline}><Plus className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      {disciplines.length === 0 && (
        <div className="text-center text-muted-foreground py-12">Aucune discipline. Ajoute ta première ci-dessus 💪</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {disciplines.map((d) => {
          const list = records.filter((r) => r.discipline_id === d.id).sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
          const best = bestFor(d, records);
          const chartData = list.map((r) => ({ date: format(new Date(r.recorded_at), "dd/MM"), value: Number(r.value) }));
          return (
            <Card key={d.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">{d.name}<Badge variant="outline">{d.unit}</Badge></CardTitle>
                  {best && (
                    <div className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400 mt-1">
                      <Trophy className="h-4 w-4" /> Record : <span className="font-semibold">{best.value} {d.unit}</span>
                      <span className="text-muted-foreground text-xs">({format(new Date(best.recorded_at), "dd/MM/yy")})</span>
                    </div>
                  )}
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeDiscipline(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </CardHeader>
              <CardContent>
                {chartData.length > 1 ? (
                  <div className="h-48 mb-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
                        <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                        <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-24 flex items-center justify-center text-sm text-muted-foreground"><TrendingUp className="h-4 w-4 mr-2" />Ajoute au moins 2 entrées pour voir la courbe</div>
                )}

                <div className="flex gap-2 mb-3">
                  <Input type="number" step="0.01" placeholder={`Valeur (${d.unit})`} value={newValues[d.id] || ""} onChange={(e) => setNewValues((p) => ({ ...p, [d.id]: e.target.value }))} />
                  <Input type="date" value={newDates[d.id] || format(new Date(), "yyyy-MM-dd")} onChange={(e) => setNewDates((p) => ({ ...p, [d.id]: e.target.value }))} className="w-40" />
                  <Button onClick={() => addRecord(d)}><Plus className="h-4 w-4" /></Button>
                </div>

                {list.length > 0 && (
                  <div className="space-y-1 max-h-40 overflow-auto">
                    {[...list].reverse().map((r) => {
                      const isBest = best?.id === r.id;
                      return (
                        <div key={r.id} className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-muted/50">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{r.value} {d.unit}</span>
                            {isBest && <Trophy className="h-3 w-3 text-emerald-500" />}
                            <span className="text-muted-foreground text-xs">{format(new Date(r.recorded_at), "dd/MM/yyyy")}</span>
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeRecord(r.id)}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
