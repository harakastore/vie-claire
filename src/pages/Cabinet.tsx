import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Calendar as CalIcon, Check } from "lucide-react";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

type CabinetTask = {
  id: string; user_id: string; type: string; title: string; description: string | null;
  priority: string | null; status: string; frequency: string | null; order_index: number;
};
type Strategy = { id: string; user_id: string; title: string; description: string | null; priority: string; status: string; order_index: number; };
type RoadmapItem = { id: string; user_id: string; title: string; description: string | null; target_date: string | null; status: string; order_index: number; };
type CnssPayment = { id: string; user_id: string; amount: number; paid_at: string; note: string | null; };

const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  high: "bg-red-500/15 text-red-600 dark:text-red-400",
};
const statusColors: Record<string, string> = {
  todo: "bg-muted text-muted-foreground",
  in_progress: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  done: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};
const statusLabel = (s: string) => s === "todo" ? "À faire" : s === "in_progress" ? "En cours" : "Terminé";
const nextStatus = (s: string) => s === "todo" ? "in_progress" : s === "in_progress" ? "done" : "todo";

export default function Cabinet() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<CabinetTask[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [roadmap, setRoadmap] = useState<RoadmapItem[]>([]);
  const [vision, setVision] = useState("");
  const [visionDraft, setVisionDraft] = useState("");
  const [cnssDue, setCnssDue] = useState<number>(0);
  const [cnssDueDraft, setCnssDueDraft] = useState<string>("0");
  const [cnssPayments, setCnssPayments] = useState<CnssPayment[]>([]);
  const [simAmount, setSimAmount] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [t, s, r, v, cc, cp] = await Promise.all([
        supabase.from("cabinet_tasks").select("*").order("order_index").order("created_at"),
        supabase.from("cabinet_marketing_strategies").select("*").order("priority", { ascending: false }).order("order_index"),
        supabase.from("cabinet_roadmap").select("*").order("target_date", { nullsFirst: false }).order("order_index"),
        supabase.from("cabinet_vision").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("cnss_config").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("cnss_payments").select("*").order("paid_at", { ascending: false }),
      ]);
      setTasks((t.data as any) || []);
      setStrategies((s.data as any) || []);
      setRoadmap((r.data as any) || []);
      setVision(v.data?.vision_text || "");
      setVisionDraft(v.data?.vision_text || "");
      setCnssDue(Number(cc.data?.total_due || 0));
      setCnssDueDraft(String(cc.data?.total_due || 0));
      setCnssPayments((cp.data as any) || []);
    })();
  }, [user]);

  // ---- Tasks (grouped by type) ----
  const tasksByType = useMemo(() => {
    const g: Record<string, CabinetTask[]> = {};
    tasks.forEach(t => { (g[t.type] = g[t.type] || []).push(t); });
    return g;
  }, [tasks]);

  async function addTask(type: string, title: string, extra: Partial<CabinetTask> = {}) {
    if (!user || !title.trim()) return;
    const optimistic: CabinetTask = {
      id: "tmp-" + Math.random(), user_id: user.id, type, title: title.trim(),
      description: null, priority: "medium", status: "todo", frequency: null, order_index: 0,
      ...extra,
    } as CabinetTask;
    setTasks(p => [optimistic, ...p]);
    const { data, error } = await supabase.from("cabinet_tasks").insert({ user_id: user.id, type, title: title.trim(), ...extra }).select().single();
    if (error) { toast.error("Erreur"); setTasks(p => p.filter(x => x.id !== optimistic.id)); return; }
    setTasks(p => p.map(x => x.id === optimistic.id ? (data as any) : x));
  }
  async function updateTask(id: string, patch: Partial<CabinetTask>) {
    setTasks(p => p.map(x => x.id === id ? { ...x, ...patch } : x));
    await supabase.from("cabinet_tasks").update(patch).eq("id", id);
  }
  async function deleteTask(id: string) {
    setTasks(p => p.filter(x => x.id !== id));
    await supabase.from("cabinet_tasks").delete().eq("id", id);
  }

  // ---- Vision ----
  async function saveVision() {
    if (!user) return;
    setVision(visionDraft);
    await supabase.from("cabinet_vision").upsert({ user_id: user.id, vision_text: visionDraft });
    toast.success("Vision enregistrée");
  }

  // ---- Strategies ----
  const [stratTitle, setStratTitle] = useState("");
  const [stratDesc, setStratDesc] = useState("");
  const [stratPrio, setStratPrio] = useState("high");
  async function addStrategy() {
    if (!user || !stratTitle.trim()) return;
    const { data } = await supabase.from("cabinet_marketing_strategies").insert({
      user_id: user.id, title: stratTitle.trim(), description: stratDesc || null, priority: stratPrio,
    }).select().single();
    if (data) setStrategies(p => [data as any, ...p]);
    setStratTitle(""); setStratDesc(""); setStratPrio("high");
  }
  async function updateStrategy(id: string, patch: Partial<Strategy>) {
    setStrategies(p => p.map(x => x.id === id ? { ...x, ...patch } : x));
    await supabase.from("cabinet_marketing_strategies").update(patch).eq("id", id);
  }
  async function deleteStrategy(id: string) {
    setStrategies(p => p.filter(x => x.id !== id));
    await supabase.from("cabinet_marketing_strategies").delete().eq("id", id);
  }

  // ---- Roadmap ----
  const [rTitle, setRTitle] = useState("");
  const [rDesc, setRDesc] = useState("");
  const [rDate, setRDate] = useState<Date | undefined>();
  async function addRoadmap() {
    if (!user || !rTitle.trim()) return;
    const { data } = await supabase.from("cabinet_roadmap").insert({
      user_id: user.id, title: rTitle.trim(), description: rDesc || null,
      target_date: rDate ? format(rDate, "yyyy-MM-dd") : null,
    }).select().single();
    if (data) setRoadmap(p => [...p, data as any].sort((a, b) => (a.target_date || "9999").localeCompare(b.target_date || "9999")));
    setRTitle(""); setRDesc(""); setRDate(undefined);
  }
  async function updateRoadmap(id: string, patch: Partial<RoadmapItem>) {
    setRoadmap(p => p.map(x => x.id === id ? { ...x, ...patch } : x));
    await supabase.from("cabinet_roadmap").update(patch).eq("id", id);
  }
  async function deleteRoadmap(id: string) {
    setRoadmap(p => p.filter(x => x.id !== id));
    await supabase.from("cabinet_roadmap").delete().eq("id", id);
  }

  // ---- CNSS ----
  async function saveCnssDue() {
    if (!user) return;
    const v = Number(cnssDueDraft) || 0;
    setCnssDue(v);
    await supabase.from("cnss_config").upsert({ user_id: user.id, total_due: v });
    toast.success("Montant dû enregistré");
  }
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState<Date | undefined>(new Date());
  const [payNote, setPayNote] = useState("");
  async function addCnssPayment() {
    if (!user || !Number(payAmount)) return;
    const { data } = await supabase.from("cnss_payments").insert({
      user_id: user.id, amount: Number(payAmount),
      paid_at: format(payDate || new Date(), "yyyy-MM-dd"), note: payNote || null,
    }).select().single();
    if (data) setCnssPayments(p => [data as any, ...p]);
    setPayAmount(""); setPayNote("");
  }
  async function deleteCnssPayment(id: string) {
    setCnssPayments(p => p.filter(x => x.id !== id));
    await supabase.from("cnss_payments").delete().eq("id", id);
  }
  const totalPaid = useMemo(() => cnssPayments.reduce((s, p) => s + Number(p.amount), 0), [cnssPayments]);
  const remaining = Math.max(0, cnssDue - totalPaid);
  const simMonths = Number(simAmount) > 0 ? Math.ceil(remaining / Number(simAmount)) : null;

  // ---- Reusable list section ----
  function TaskListSection({ type, title, desc, withFreq = false, placeholder = "Ajouter..." }: {
    type: string; title: string; desc?: string; withFreq?: boolean; placeholder?: string;
  }) {
    const [val, setVal] = useState("");
    const [freq, setFreq] = useState("hebdo");
    const items = tasksByType[type] || [];
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
          {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input value={val} onChange={e => setVal(e.target.value)} placeholder={placeholder}
              onKeyDown={e => { if (e.key === "Enter") { addTask(type, val, withFreq ? { frequency: freq } : {}); setVal(""); } }} />
            {withFreq && (
              <Select value={freq} onValueChange={setFreq}>
                <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="quotidien">Quotidien</SelectItem>
                  <SelectItem value="hebdo">Hebdomadaire</SelectItem>
                  <SelectItem value="mensuel">Mensuel</SelectItem>
                  <SelectItem value="trimestriel">Trimestriel</SelectItem>
                  <SelectItem value="annuel">Annuel</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Button onClick={() => { addTask(type, val, withFreq ? { frequency: freq } : {}); setVal(""); }}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {items.length === 0 && <p className="text-xs text-muted-foreground italic">Vide.</p>}
          <div className="space-y-2">
            {items.map(t => (
              <div key={t.id} className="flex items-start gap-2 p-2 rounded border bg-card">
                <button onClick={() => updateTask(t.id, { status: nextStatus(t.status) })}
                  className={cn("mt-0.5 h-5 w-5 rounded border flex items-center justify-center shrink-0",
                    t.status === "done" ? "bg-emerald-500 border-emerald-500 text-white" : "")}>
                  {t.status === "done" && <Check className="h-3 w-3" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm", t.status === "done" && "line-through text-muted-foreground")}>{t.title}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <Badge variant="outline" className={statusColors[t.status]}>{statusLabel(t.status)}</Badge>
                    {t.frequency && <Badge variant="outline" className="text-xs">{t.frequency}</Badge>}
                    {t.priority && type !== "brainstorm" && <Badge variant="outline" className={priorityColors[t.priority]}>{t.priority}</Badge>}
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => deleteTask(t.id)} className="h-7 w-7">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <PageHeader title="Cabinet" description="Gestion complète : tâches, marketing, SOPs, roadmap, vision et CNSS." />
      <Tabs defaultValue="todo" className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="todo">À faire</TabsTrigger>
          <TabsTrigger value="maint">Maintenance</TabsTrigger>
          <TabsTrigger value="marketing">Marketing</TabsTrigger>
          <TabsTrigger value="sop">SOPs & Process</TabsTrigger>
          <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
          <TabsTrigger value="vision">Vision 2 ans</TabsTrigger>
          <TabsTrigger value="cnss">CNSS</TabsTrigger>
        </TabsList>

        <TabsContent value="todo" className="mt-4">
          <TaskListSection type="todo" title="Tâches du cabinet" placeholder="Nouvelle tâche..." />
        </TabsContent>

        <TabsContent value="maint" className="mt-4 grid gap-4 md:grid-cols-2">
          <TaskListSection type="maintenance" title="À faire (maintenance ponctuelle)" placeholder="Ex: Réparer climatiseur" />
          <TaskListSection type="maintenance_routine" title="Routine de maintenance" desc="Tâches récurrentes" withFreq placeholder="Ex: Nettoyage profond" />
        </TabsContent>

        <TabsContent value="marketing" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <TaskListSection type="brainstorm" title="🧠 Brainstorming Marketing" desc="Idées brutes, capture rapide" placeholder="Une idée..." />
            <Card>
              <CardHeader><CardTitle className="text-base">🎯 Stratégies prioritaires (détaillées)</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 p-3 rounded border bg-muted/30">
                  <Input value={stratTitle} onChange={e => setStratTitle(e.target.value)} placeholder="Titre de la stratégie" />
                  <Textarea value={stratDesc} onChange={e => setStratDesc(e.target.value)} placeholder="Détails, étapes..." rows={3} />
                  <div className="flex gap-2">
                    <Select value={stratPrio} onValueChange={setStratPrio}>
                      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">Haute</SelectItem>
                        <SelectItem value="medium">Moyenne</SelectItem>
                        <SelectItem value="low">Basse</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={addStrategy}><Plus className="h-4 w-4 mr-1" />Ajouter</Button>
                  </div>
                </div>
                {strategies.length === 0 && <p className="text-xs text-muted-foreground italic">Aucune stratégie.</p>}
                {strategies.map(s => (
                  <div key={s.id} className="p-3 rounded border bg-card space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn("font-medium text-sm flex-1", s.status === "done" && "line-through text-muted-foreground")}>{s.title}</p>
                      <Button size="icon" variant="ghost" onClick={() => deleteStrategy(s.id)} className="h-7 w-7"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                    {s.description && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{s.description}</p>}
                    <div className="flex flex-wrap gap-2 items-center">
                      <Badge className={priorityColors[s.priority]}>{s.priority === "high" ? "Haute" : s.priority === "medium" ? "Moyenne" : "Basse"}</Badge>
                      <Select value={s.status} onValueChange={(v) => updateStrategy(s.id, { status: v })}>
                        <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todo">À faire</SelectItem>
                          <SelectItem value="in_progress">En cours</SelectItem>
                          <SelectItem value="done">Terminé</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sop" className="mt-4">
          <TaskListSection type="sop" title="SOPs & Process à poser ou améliorer" placeholder="Ex: Process accueil patient" />
        </TabsContent>

        <TabsContent value="roadmap" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">🗺️ Roadmap du cabinet</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 p-3 rounded border bg-muted/30">
                <Input value={rTitle} onChange={e => setRTitle(e.target.value)} placeholder="Étape" />
                <Textarea value={rDesc} onChange={e => setRDesc(e.target.value)} placeholder="Détails..." rows={2} />
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("justify-start font-normal", !rDate && "text-muted-foreground")}>
                        <CalIcon className="h-4 w-4 mr-2" />
                        {rDate ? format(rDate, "PPP", { locale: fr }) : "Date cible"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={rDate} onSelect={setRDate} initialFocus className={cn("p-3 pointer-events-auto")} locale={fr} />
                    </PopoverContent>
                  </Popover>
                  <Button onClick={addRoadmap}><Plus className="h-4 w-4 mr-1" />Ajouter</Button>
                </div>
              </div>
              {roadmap.length === 0 && <p className="text-xs text-muted-foreground italic">Aucune étape.</p>}
              {roadmap.map(r => (
                <div key={r.id} className="p-3 rounded border bg-card flex items-start gap-3">
                  <button onClick={() => updateRoadmap(r.id, { status: nextStatus(r.status) })}
                    className={cn("mt-0.5 h-5 w-5 rounded border flex items-center justify-center shrink-0",
                      r.status === "done" ? "bg-emerald-500 border-emerald-500 text-white" : "")}>
                    {r.status === "done" && <Check className="h-3 w-3" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn("font-medium text-sm", r.status === "done" && "line-through text-muted-foreground")}>{r.title}</p>
                    </div>
                    {r.description && <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-1">{r.description}</p>}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button size="sm" variant="outline" className="h-7 text-xs">
                            <CalIcon className="h-3 w-3 mr-1" />
                            {r.target_date ? format(new Date(r.target_date), "PPP", { locale: fr }) : "Pas de date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={r.target_date ? new Date(r.target_date) : undefined}
                            onSelect={(d) => updateRoadmap(r.id, { target_date: d ? format(d, "yyyy-MM-dd") : null })}
                            initialFocus className={cn("p-3 pointer-events-auto")} locale={fr} />
                        </PopoverContent>
                      </Popover>
                      <Badge variant="outline" className={statusColors[r.status]}>{statusLabel(r.status)}</Badge>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => deleteRoadmap(r.id)} className="h-7 w-7"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vision" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">🔭 Vision du cabinet dans 2 ans</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Textarea value={visionDraft} onChange={e => setVisionDraft(e.target.value)} rows={12}
                placeholder="Où je vois mon cabinet dans 2 ans : revenus, équipe, services, image, impact..." />
              <div className="flex justify-end">
                <Button onClick={saveVision} disabled={visionDraft === vision}>Enregistrer la vision</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cnss" className="mt-4 grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">📊 Suivi CNSS</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium">Montant total dû (DH)</label>
                <div className="flex gap-2">
                  <Input type="number" value={cnssDueDraft} onChange={e => setCnssDueDraft(e.target.value)} />
                  <Button onClick={saveCnssDue}>OK</Button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 rounded border bg-muted/30">
                  <p className="text-xs text-muted-foreground">Dû total</p>
                  <p className="font-semibold">{cnssDue.toLocaleString("fr-FR")} DH</p>
                </div>
                <div className="p-3 rounded border bg-emerald-500/10">
                  <p className="text-xs text-muted-foreground">Payé</p>
                  <p className="font-semibold text-emerald-600 dark:text-emerald-400">{totalPaid.toLocaleString("fr-FR")} DH</p>
                </div>
                <div className="p-3 rounded border bg-red-500/10">
                  <p className="text-xs text-muted-foreground">Reste</p>
                  <p className="font-semibold text-red-600 dark:text-red-400">{remaining.toLocaleString("fr-FR")} DH</p>
                </div>
              </div>
              <div className="space-y-2 pt-2 border-t">
                <p className="text-sm font-medium">🧮 Simulateur</p>
                <p className="text-xs text-muted-foreground">Si je paye X DH par mois, en combien de temps je termine ?</p>
                <div className="flex gap-2">
                  <Input type="number" value={simAmount} onChange={e => setSimAmount(e.target.value)} placeholder="Montant mensuel" />
                </div>
                {simMonths !== null && (
                  <p className="text-sm">
                    ➜ <b>{simMonths} mois</b> ({Math.floor(simMonths / 12)} an{Math.floor(simMonths / 12) > 1 ? "s" : ""} {simMonths % 12} mois)
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">💸 Paiements CNSS</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 p-3 rounded border bg-muted/30">
                <Input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="Montant (DH)" />
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="flex-1 justify-start font-normal">
                        <CalIcon className="h-4 w-4 mr-2" />
                        {payDate ? format(payDate, "PPP", { locale: fr }) : "Date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={payDate} onSelect={setPayDate} initialFocus className={cn("p-3 pointer-events-auto")} locale={fr} />
                    </PopoverContent>
                  </Popover>
                  <Button onClick={addCnssPayment}><Plus className="h-4 w-4" /></Button>
                </div>
                <Input value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="Note (optionnel)" />
              </div>
              {cnssPayments.length === 0 && <p className="text-xs text-muted-foreground italic">Aucun paiement.</p>}
              <div className="space-y-1 max-h-96 overflow-auto">
                {cnssPayments.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-sm p-2 rounded border">
                    <div>
                      <p className="font-medium">{Number(p.amount).toLocaleString("fr-FR")} DH</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(p.paid_at), "PPP", { locale: fr })}{p.note ? ` — ${p.note}` : ""}</p>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => deleteCnssPayment(p.id)} className="h-7 w-7"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
