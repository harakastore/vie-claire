import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Trash2, Trophy, ChevronDown, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { toast } from "sonner";

import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { History } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [selected, setSelected] = useState<Discipline | null>(null);

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

  const listFor = (id: string) =>
    records.filter((r) => r.discipline_id === id).sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));

  const bestFor = (d: Discipline, rs: Record_[]) => {
    const list = rs.filter((r) => r.discipline_id === d.id);
    if (!list.length) return null;
    return d.type === "time"
      ? list.reduce((a, b) => (Number(a.value) <= Number(b.value) ? a : b))
      : list.reduce((a, b) => (Number(a.value) >= Number(b.value) ? a : b));
  };

  const trendOf = (d: Discipline) => {
    const list = listFor(d.id);
    if (list.length < 2) return 0;
    const diff = Number(list[list.length - 1].value) - Number(list[list.length - 2].value);
    if (diff === 0) return 0;
    const better = d.type === "time" ? diff < 0 : diff > 0;
    return better ? 1 : -1;
  };

  return <div className="space-y-6">
    <PageHeader title="Performances Sport" />
    <div className="flex flex-wrap gap-2 border-b pb-5">
      <Input aria-label="Nom de l’exercice" placeholder="Nouvel exercice" value={name} onChange={e=>setName(e.target.value)} className="w-full sm:w-64" />
      <Input aria-label="Unité" value={unit} onChange={e=>setUnit(e.target.value)} className="w-24" />
      <Select value={type} onValueChange={setType}><SelectTrigger className="w-64"><SelectValue/></SelectTrigger><SelectContent>{TYPES.map(t=><SelectItem key={t.v} value={t.v}>{t.label}</SelectItem>)}</SelectContent></Select>
      <Button onClick={addDiscipline}><Plus className="h-4 w-4 mr-2"/>Ajouter</Button>
    </div>
    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{disciplines.map(d=>{const best=bestFor(d,records);return <article key={d.id} className="border rounded-lg bg-card p-5 space-y-5">
      <div className="flex justify-between gap-2"><h2 className="font-semibold break-words">{d.name}</h2><Trophy className="h-5 w-5 text-primary shrink-0"/></div>
      <p className="text-4xl font-bold tabular-nums">{best?.value??'—'} <span className="text-base font-normal text-muted-foreground">{d.unit}</span></p>
      <div className="flex justify-between gap-2"><Button variant="outline" size="sm" onClick={()=>setSelected(d)}><History className="h-4 w-4 mr-2"/>Data entry / Historique</Button><Button variant="ghost" size="icon" aria-label={`Supprimer ${d.name}`} onClick={()=>removeDiscipline(d.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button></div>
    </article>})}</div>
    {!disciplines.length&&<p className="text-muted-foreground py-8">Aucun exercice enregistré.</p>}
    <Dialog open={!!selected} onOpenChange={v=>{if(!v)setSelected(null)}}><DialogContent className="max-w-2xl max-h-[90vh] overflow-auto"><DialogHeader><DialogTitle>{selected?.name}</DialogTitle></DialogHeader>{selected&&<Tabs defaultValue="entry"><TabsList><TabsTrigger value="entry">Data entry</TabsTrigger><TabsTrigger value="history">Historique</TabsTrigger></TabsList><TabsContent value="entry" className="space-y-4">
      <label className="block text-sm">Valeur ({selected.unit})<Input aria-label="Performance" type="number" step="0.01" value={newValues[selected.id]||''} onChange={e=>setNewValues(p=>({...p,[selected.id]:e.target.value}))}/></label>
      <label className="block text-sm">Date<Input aria-label="Date de performance" type="date" value={newDates[selected.id]||format(new Date(),'yyyy-MM-dd')} onChange={e=>setNewDates(p=>({...p,[selected.id]:e.target.value}))}/></label>
      <Button onClick={()=>addRecord(selected)}><Plus className="h-4 w-4 mr-2"/>Enregistrer</Button>
    </TabsContent><TabsContent value="history"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Performance</TableHead><TableHead/></TableRow></TableHeader><TableBody>{listFor(selected.id).reverse().map(r=><TableRow key={r.id}><TableCell>{format(new Date(r.recorded_at),'dd/MM/yyyy')}</TableCell><TableCell>{r.value} {selected.unit}</TableCell><TableCell><Button variant="ghost" size="icon" aria-label="Supprimer cette performance" onClick={()=>removeRecord(r.id)}><Trash2 className="h-4 w-4"/></Button></TableCell></TableRow>)}</TableBody></Table>{!listFor(selected.id).length&&<p className="text-muted-foreground py-4">Aucune performance.</p>}</TabsContent></Tabs>}</DialogContent></Dialog>
  </div>;
}
