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
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { format } from "date-fns";
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
  const [open, setOpen] = useState<Record<string, boolean>>({});

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

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      <PageHeader title="Performances Sport" description="Tes records par discipline, en tableau" />

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

      {disciplines.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">Aucune discipline. Ajoute ta première ci-dessus 💪</div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Discipline</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Record</TableHead>
                  <TableHead className="text-right">Dernier</TableHead>
                  <TableHead className="text-center">Tendance</TableHead>
                  <TableHead className="text-center">Entrées</TableHead>
                  <TableHead className="w-[320px]">Nouvelle perf</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {disciplines.map((d) => {
                  const list = listFor(d.id);
                  const best = bestFor(d, records);
                  const last = list[list.length - 1];
                  const trend = trendOf(d);
                  const isOpen = !!open[d.id];
                  const chartData = list.map((r) => ({ date: format(new Date(r.recorded_at), "dd/MM"), value: Number(r.value) }));
                  return (
                    <Collapsible key={d.id} asChild open={isOpen} onOpenChange={(v) => setOpen((p) => ({ ...p, [d.id]: v }))}>
                      <>
                        <TableRow className="align-middle">
                          <TableCell>
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                              </Button>
                            </CollapsibleTrigger>
                          </TableCell>
                          <TableCell className="font-semibold">{d.name}</TableCell>
                          <TableCell><Badge variant="outline">{TYPES.find((t) => t.v === d.type)?.v ?? d.type} · {d.unit}</Badge></TableCell>
                          <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">
                            {best ? (
                              <span className="inline-flex items-center gap-1"><Trophy className="h-3.5 w-3.5" />{best.value} {d.unit}</span>
                            ) : <span className="text-muted-foreground font-normal">—</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            {last ? <span>{last.value} {d.unit} <span className="text-xs text-muted-foreground">({format(new Date(last.recorded_at), "dd/MM/yy")})</span></span> : "—"}
                          </TableCell>
                          <TableCell className="text-center">
                            {trend > 0 ? <TrendingUp className="h-4 w-4 mx-auto text-emerald-500" />
                              : trend < 0 ? <TrendingDown className="h-4 w-4 mx-auto text-destructive" />
                              : <Minus className="h-4 w-4 mx-auto text-muted-foreground" />}
                          </TableCell>
                          <TableCell className="text-center text-muted-foreground">{list.length}</TableCell>
                          <TableCell>
                            <div className="flex gap-1.5">
                              <Input type="number" step="0.01" placeholder={d.unit} value={newValues[d.id] || ""} onChange={(e) => setNewValues((p) => ({ ...p, [d.id]: e.target.value }))} className="h-8 w-24" />
                              <Input type="date" value={newDates[d.id] || format(new Date(), "yyyy-MM-dd")} onChange={(e) => setNewDates((p) => ({ ...p, [d.id]: e.target.value }))} className="h-8 w-36" />
                              <Button size="sm" className="h-8" onClick={() => addRecord(d)}><Plus className="h-4 w-4" /></Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeDiscipline(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </TableCell>
                        </TableRow>
                        <CollapsibleContent asChild>
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableCell colSpan={9} className="p-4">
                              <div className="grid gap-4 lg:grid-cols-2">
                                {chartData.length > 1 ? (
                                  <div className="h-44">
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
                                  <div className="h-44 flex items-center justify-center text-sm text-muted-foreground">Ajoute au moins 2 entrées pour voir la courbe</div>
                                )}
                                <div className="max-h-44 overflow-auto rounded-md border bg-card">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="h-8 text-xs">Date</TableHead>
                                        <TableHead className="h-8 text-xs text-right">Valeur</TableHead>
                                        <TableHead className="h-8 w-8" />
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {[...list].reverse().map((r) => (
                                        <TableRow key={r.id}>
                                          <TableCell className="py-1.5 text-sm">{format(new Date(r.recorded_at), "dd/MM/yyyy")}</TableCell>
                                          <TableCell className="py-1.5 text-sm text-right font-medium">
                                            {r.value} {d.unit} {best?.id === r.id && <Trophy className="inline h-3 w-3 text-emerald-500 ml-1" />}
                                          </TableCell>
                                          <TableCell className="py-1.5">
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeRecord(r.id)}><Trash2 className="h-3 w-3" /></Button>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                      {list.length === 0 && (
                                        <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-4">Aucune entrée</TableCell></TableRow>
                                      )}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
