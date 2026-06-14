import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type Learn = {
  id: string; user_id: string; category: string; title: string;
  resource_url: string | null; notes: string | null; status: string; order_index: number;
};

const DEFAULT_CATEGORIES = [
  "Langues",
  "E-commerce",
  "Gestion team & humain",
  "Communication & élocution",
  "Développement personnel",
  "En tant que mari",
];

const statusColors: Record<string, string> = {
  todo: "bg-muted text-muted-foreground",
  in_progress: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  done: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};
const statusLabel = (s: string) => s === "todo" ? "À commencer" : s === "in_progress" ? "En cours" : "Terminé";
const nextStatus = (s: string) => s === "todo" ? "in_progress" : s === "in_progress" ? "done" : "todo";

export default function Apprentissage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Learn[]>([]);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(DEFAULT_CATEGORIES[0]);
  const [customCat, setCustomCat] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("learning_items").select("*").order("order_index").order("created_at", { ascending: false });
      setItems((data as any) || []);
    })();
  }, [user]);

  const allCategories = useMemo(() => {
    const set = new Set<string>(DEFAULT_CATEGORIES);
    items.forEach(i => set.add(i.category));
    return Array.from(set);
  }, [items]);

  const byCategory = useMemo(() => {
    const g: Record<string, Learn[]> = {};
    items.forEach(i => { (g[i.category] = g[i.category] || []).push(i); });
    return g;
  }, [items]);

  async function addItem() {
    const finalCat = (customCat.trim() || category).trim();
    if (!user || !title.trim() || !finalCat) return;
    const optimistic: Learn = {
      id: "tmp-" + Math.random(), user_id: user.id, category: finalCat, title: title.trim(),
      resource_url: url || null, notes: notes || null, status: "todo", order_index: 0,
    };
    setItems(p => [optimistic, ...p]);
    const { data, error } = await supabase.from("learning_items").insert({
      user_id: user.id, category: finalCat, title: title.trim(),
      resource_url: url || null, notes: notes || null,
    }).select().single();
    if (error) { toast.error("Erreur"); setItems(p => p.filter(x => x.id !== optimistic.id)); return; }
    setItems(p => p.map(x => x.id === optimistic.id ? (data as any) : x));
    setTitle(""); setUrl(""); setNotes(""); setCustomCat("");
  }
  async function updateItem(id: string, patch: Partial<Learn>) {
    setItems(p => p.map(x => x.id === id ? { ...x, ...patch } : x));
    await supabase.from("learning_items").update(patch).eq("id", id);
  }
  async function deleteItem(id: string) {
    setItems(p => p.filter(x => x.id !== id));
    await supabase.from("learning_items").delete().eq("id", id);
  }

  return (
    <div>
      <PageHeader title="Apprentissage" description="Mon parcours de formation continue, organisé par catégorie." />

      <Card className="mb-6">
        <CardHeader><CardTitle className="text-base">➕ Ajouter un sujet à apprendre</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-2">
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titre (ex: Apprendre l'anglais)" />
            <div className="flex gap-2">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input value={customCat} onChange={e => setCustomCat(e.target.value)} placeholder="ou nouvelle catégorie" className="flex-1" />
            </div>
          </div>
          <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="Lien ressource (optionnel)" />
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optionnel)" rows={2} />
          <Button onClick={addItem}><Plus className="h-4 w-4 mr-1" />Ajouter</Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all">Toutes</TabsTrigger>
          {allCategories.map(c => (byCategory[c]?.length || 0) > 0 && (
            <TabsTrigger key={c} value={c}>{c}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all" className="mt-4 space-y-6">
          {allCategories.map(c => {
            const list = byCategory[c] || [];
            if (list.length === 0) return null;
            return <CategoryBlock key={c} title={c} items={list} onToggle={updateItem} onDelete={deleteItem} />;
          })}
          {items.length === 0 && <p className="text-sm text-muted-foreground italic">Aucun sujet pour l'instant.</p>}
        </TabsContent>

        {allCategories.map(c => (
          <TabsContent key={c} value={c} className="mt-4">
            <CategoryBlock title={c} items={byCategory[c] || []} onToggle={updateItem} onDelete={deleteItem} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );

  function CategoryBlock({ title, items, onToggle, onDelete }: {
    title: string; items: Learn[];
    onToggle: (id: string, p: Partial<Learn>) => void;
    onDelete: (id: string) => void;
  }) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            {title} <Badge variant="secondary">{items.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.length === 0 && <p className="text-xs text-muted-foreground italic">Vide.</p>}
          {items.map(i => (
            <div key={i.id} className="flex items-start gap-2 p-2 rounded border bg-card">
              <button onClick={() => onToggle(i.id, { status: nextStatus(i.status) })}
                className={cn("mt-0.5 h-5 w-5 rounded border flex items-center justify-center shrink-0",
                  i.status === "done" ? "bg-emerald-500 border-emerald-500 text-white" : "")}>
                {i.status === "done" && <Check className="h-3 w-3" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-medium", i.status === "done" && "line-through text-muted-foreground")}>{i.title}</p>
                {i.notes && <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-1">{i.notes}</p>}
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <Badge variant="outline" className={statusColors[i.status]}>{statusLabel(i.status)}</Badge>
                  {i.resource_url && (
                    <a href={i.resource_url} target="_blank" rel="noreferrer"
                      className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
                      <ExternalLink className="h-3 w-3" /> Ressource
                    </a>
                  )}
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => onDelete(i.id)} className="h-7 w-7"><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }
}
