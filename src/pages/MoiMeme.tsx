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
import { Plus, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Item = {
  id: string; user_id: string; type: string; title: string; description: string | null;
  priority: string | null; status: string; order_index: number;
};

const statusColors: Record<string, string> = {
  todo: "bg-muted text-muted-foreground",
  in_progress: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  done: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};
const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  high: "bg-red-500/15 text-red-600 dark:text-red-400",
};
const statusLabel = (s: string) => s === "todo" ? "À faire" : s === "in_progress" ? "En cours" : "Fait";
const nextStatus = (s: string) => s === "todo" ? "in_progress" : s === "in_progress" ? "done" : "todo";

export default function MoiMeme() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("personal_items").select("*").order("order_index").order("created_at", { ascending: false });
      setItems((data as any) || []);
    })();
  }, [user]);

  const byType = useMemo(() => {
    const g: Record<string, Item[]> = {};
    items.forEach(i => { (g[i.type] = g[i.type] || []).push(i); });
    return g;
  }, [items]);

  async function addItem(type: string, title: string, description?: string, priority = "medium") {
    if (!user || !title.trim()) return;
    const optimistic: Item = {
      id: "tmp-" + Math.random(), user_id: user.id, type, title: title.trim(),
      description: description || null, priority, status: "todo", order_index: 0,
    };
    setItems(p => [optimistic, ...p]);
    const { data, error } = await supabase.from("personal_items").insert({
      user_id: user.id, type, title: title.trim(), description: description || null, priority,
    }).select().single();
    if (error) { toast.error("Erreur"); setItems(p => p.filter(x => x.id !== optimistic.id)); return; }
    setItems(p => p.map(x => x.id === optimistic.id ? (data as any) : x));
  }
  async function updateItem(id: string, patch: Partial<Item>) {
    setItems(p => p.map(x => x.id === id ? { ...x, ...patch } : x));
    await supabase.from("personal_items").update(patch).eq("id", id);
  }
  async function deleteItem(id: string) {
    setItems(p => p.filter(x => x.id !== id));
    await supabase.from("personal_items").delete().eq("id", id);
  }

  function Section({ type, title, desc, withPriority = true, placeholder = "Ajouter..." }: {
    type: string; title: string; desc?: string; withPriority?: boolean; placeholder?: string;
  }) {
    const [val, setVal] = useState("");
    const [prio, setPrio] = useState("medium");
    const list = byType[type] || [];
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
          {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input value={val} onChange={e => setVal(e.target.value)} placeholder={placeholder}
              onKeyDown={e => { if (e.key === "Enter") { addItem(type, val, undefined, prio); setVal(""); } }} />
            {withPriority && (
              <Select value={prio} onValueChange={setPrio}>
                <SelectTrigger className="w-full sm:w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">Haute</SelectItem>
                  <SelectItem value="medium">Moyenne</SelectItem>
                  <SelectItem value="low">Basse</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Button onClick={() => { addItem(type, val, undefined, prio); setVal(""); }}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {list.length === 0 && <p className="text-xs text-muted-foreground italic">Vide.</p>}
          <div className="space-y-2">
            {list.map(i => (
              <div key={i.id} className="flex items-start gap-2 p-2 rounded border bg-card">
                <button onClick={() => updateItem(i.id, { status: nextStatus(i.status) })}
                  className={cn("mt-0.5 h-5 w-5 rounded border flex items-center justify-center shrink-0",
                    i.status === "done" ? "bg-emerald-500 border-emerald-500 text-white" : "")}>
                  {i.status === "done" && <Check className="h-3 w-3" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm", i.status === "done" && "line-through text-muted-foreground")}>{i.title}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <Badge variant="outline" className={statusColors[i.status]}>{statusLabel(i.status)}</Badge>
                    {withPriority && i.priority && <Badge variant="outline" className={priorityColors[i.priority]}>{i.priority}</Badge>}
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => deleteItem(i.id)} className="h-7 w-7">
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
      <PageHeader title="Moi-même" description="Standards, habitudes, achats et spiritualité — devenir ma meilleure version." />
      <Tabs defaultValue="shopping" className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="shopping">🛍️ À acheter</TabsTrigger>
          <TabsTrigger value="habits">🔄 Habitudes</TabsTrigger>
          <TabsTrigger value="standards">⚖️ Standards</TabsTrigger>
          <TabsTrigger value="islamic">🕌 Spiritualité</TabsTrigger>
        </TabsList>

        <TabsContent value="shopping" className="mt-4">
          <Section type="shopping" title="Liste d'achats personnels" desc="Ex: 3 pantalons, montre, livres..." placeholder="Article à acheter" />
        </TabsContent>

        <TabsContent value="habits" className="mt-4 grid gap-4 md:grid-cols-2">
          <Section type="bad_habit" title="❌ Habitudes à changer" desc="Mauvaises habitudes à éliminer" placeholder="Ex: Réseaux sociaux le matin" />
          <Section type="good_habit" title="✅ Bonnes habitudes à implémenter" desc="Pour être un homme organisé" placeholder="Ex: Lecture 30min/jour" />
        </TabsContent>

        <TabsContent value="standards" className="mt-4 grid gap-4 md:grid-cols-2">
          <Section type="standard_self" title="🪞 Standards envers moi-même" placeholder="Ex: Toujours tenir ma parole" withPriority={false} />
          <Section type="standard_others" title="👥 Standards avec les gens" placeholder="Ex: Respect du temps des autres" withPriority={false} />
        </TabsContent>

        <TabsContent value="islamic" className="mt-4">
          <Section type="islamic" title="🕌 Pratiques islamiques à appliquer" desc="Pour ma meilleure version vis-à-vis de Dieu" placeholder="Ex: Lire 1 page Coran/jour" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
