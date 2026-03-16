import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SectorBadge } from "@/components/SectorBadge";
import { AutocompleteInput, saveAutocomplete } from "@/components/AutocompleteInput";
import { ManageChoices } from "@/components/ManageChoices";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Download, CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { CsvUploadDialog } from "@/components/CsvUploadDialog";

interface Expense {
  id: string; user_id: string; amount: number; date: string; category: string | null;
  vendor: string | null; notes: string | null; sector: string;
}

export default function Expenses() {
  const { user } = useAuth();
  const [tab, setTab] = useState("expenses");

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Dépenses & Revenus" description="Gérez vos flux financiers" />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="expenses">Dépenses</TabsTrigger>
          <TabsTrigger value="revenues">Revenus</TabsTrigger>
        </TabsList>
        <TabsContent value="expenses" className="space-y-6 mt-4">
          <ExpensesTab />
        </TabsContent>
        <TabsContent value="revenues" className="space-y-6 mt-4">
          <RevenuesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ExpensesTab() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [sectorFilter, setSectorFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [saving, setSaving] = useState(false);

  const [amount, setAmount] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [sector, setSector] = useState("perso");

  const fetchExpenses = async () => {
    if (!user) return;
    setLoading(true);
    let q = supabase.from("expenses").select("*").order("date", { ascending: false });
    if (sectorFilter !== "all") q = q.eq("sector", sectorFilter);
    if (categoryFilter) q = q.ilike("category", `%${categoryFilter}%`);
    const { data } = await q;
    setExpenses((data as Expense[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchExpenses(); }, [user, sectorFilter, categoryFilter]);

  const resetForm = () => { setAmount(""); setDate(new Date()); setCategory(""); setNotes(""); setSector("perso"); setEditId(null); };

  const openEdit = (e: Expense) => {
    setEditId(e.id); setAmount(String(e.amount)); setDate(new Date(e.date));
    setCategory(e.category || ""); setNotes(e.notes || ""); setSector(e.sector);
    setSheetOpen(true);
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!user || !amount) return;
    setSaving(true);
    const payload = {
      user_id: user.id, amount: parseFloat(amount), date: format(date, "yyyy-MM-dd"),
      category: category.trim() || null, notes: notes.trim() || null, sector,
    };
    const { error } = editId
      ? await supabase.from("expenses").update(payload).eq("id", editId)
      : await supabase.from("expenses").insert(payload);
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else {
      if (category.trim()) saveAutocomplete(user.id, "expense_category", category.trim());
      toast({ title: editId ? "Dépense modifiée" : "Dépense enregistrée" });
      resetForm(); setSheetOpen(false); fetchExpenses();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("expenses").delete().eq("id", id);
    toast({ title: "Dépense supprimée" }); fetchExpenses();
  };

  const exportCSV = () => {
    const headers = ["Date", "Montant", "Catégorie", "Secteur", "Notes"];
    const rows = expenses.map((e) => [e.date, e.amount, e.category || "", e.sector, e.notes || ""]);
    const csv = [headers, ...rows].map((r) => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "depenses.csv"; a.click();
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Select value={sectorFilter} onValueChange={setSectorFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous secteurs</SelectItem>
            <SelectItem value="perso">Vie Perso</SelectItem>
            <SelectItem value="cabinet">Cabinet</SelectItem>
          </SelectContent>
        </Select>
        <Input placeholder="Filtrer par catégorie..." value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-48" />
        <div className="ml-auto flex gap-2">
          <CsvUploadDialog
            label="Importer CSV"
            targetFields={[
              { value: "amount", label: "Montant" },
              { value: "date", label: "Date" },
              { value: "category", label: "Catégorie" },
              { value: "sector", label: "Secteur" },
              { value: "notes", label: "Notes" },
              { value: "vendor", label: "Fournisseur" },
            ]}
            requiredFields={["amount"]}
            onImport={async (rows) => {
              if (!user) return;
              const payload = rows.map((r) => ({
                user_id: user.id,
                amount: parseFloat(r.amount) || 0,
                date: r.date || format(new Date(), "yyyy-MM-dd"),
                category: r.category || null,
                sector: ["perso", "cabinet"].includes(r.sector?.toLowerCase()) ? r.sector.toLowerCase() : "perso",
                notes: r.notes || null,
                vendor: r.vendor || null,
              }));
              const { error } = await supabase.from("expenses").insert(payload);
              if (error) throw new Error(error.message);
              fetchExpenses();
            }}
          />
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="mr-2 h-4 w-4" />CSV</Button>
          <Sheet open={sheetOpen} onOpenChange={(o) => { setSheetOpen(o); if (!o) resetForm(); }}>
            <SheetTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />Ajouter</Button></SheetTrigger>
            <SheetContent className="overflow-auto">
              <SheetHeader><SheetTitle>{editId ? "Modifier la dépense" : "Nouvelle dépense"}</SheetTitle></SheetHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-6">
                <div className="space-y-2"><Label>Montant (MAD)</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="0.00" /></div>
                <div className="space-y-2"><Label>Date</Label>
                  <Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{format(date, "PPP", { locale: fr })}</Button></PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus className="p-3 pointer-events-auto" /></PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2"><Label>Secteur</Label>
                  <Select value={sector} onValueChange={setSector}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="perso">Vie Perso</SelectItem><SelectItem value="cabinet">Cabinet</SelectItem></SelectContent></Select>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-1"><Label>Catégorie</Label><ManageChoices fieldType="expense_category" label="Catégories dépenses" /></div>
                  <AutocompleteInput fieldType="expense_category" value={category} onChange={setCategory} placeholder="Ex: Électricité, Loyer..." />
                </div>
                <div className="space-y-2"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes..." rows={2} /></div>
                <Button type="submit" className="w-full" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editId ? "Modifier" : "Enregistrer"}</Button>
              </form>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <Card className="glass-card">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : expenses.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">Aucune dépense.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Secteur</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-sm">{format(new Date(e.date), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="font-medium tabular-nums">{Number(e.amount).toLocaleString("fr-FR")} MAD</TableCell>
                    <TableCell className="text-sm">{e.category || "—"}</TableCell>
                    <TableCell><SectorBadge sector={e.sector} /></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function RevenuesTab() {
  const { user } = useAuth();
  const [revenues, setRevenues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");

  const [amount, setAmount] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");

  const fetchRevenues = async () => {
    if (!user) return;
    setLoading(true);
    let q = (supabase.from("revenues" as any) as any).select("*").order("date", { ascending: false });
    if (categoryFilter) q = q.ilike("category", `%${categoryFilter}%`);
    const { data } = await q;
    setRevenues(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchRevenues(); }, [user, categoryFilter]);

  const resetForm = () => { setAmount(""); setDate(new Date()); setCategory(""); setNotes(""); setEditId(null); };

  const openEdit = (r: any) => {
    setEditId(r.id); setAmount(String(r.amount)); setDate(new Date(r.date));
    setCategory(r.category || ""); setNotes(r.notes || ""); setSheetOpen(true);
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!user || !amount) return;
    setSaving(true);
    const payload = { user_id: user.id, amount: parseFloat(amount), date: format(date, "yyyy-MM-dd"), category: category.trim() || null, notes: notes.trim() || null };
    const { error } = editId
      ? await (supabase.from("revenues" as any) as any).update(payload).eq("id", editId)
      : await (supabase.from("revenues" as any) as any).insert(payload);
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else {
      if (category.trim()) saveAutocomplete(user.id, "revenue_category", category.trim());
      toast({ title: editId ? "Revenu modifié" : "Revenu enregistré" });
      resetForm(); setSheetOpen(false); fetchRevenues();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await (supabase.from("revenues" as any) as any).delete().eq("id", id);
    toast({ title: "Revenu supprimé" }); fetchRevenues();
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="Filtrer par catégorie..." value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-48" />
        <div className="ml-auto">
          <Sheet open={sheetOpen} onOpenChange={(o) => { setSheetOpen(o); if (!o) resetForm(); }}>
            <SheetTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />Ajouter un revenu</Button></SheetTrigger>
            <SheetContent className="overflow-auto">
              <SheetHeader><SheetTitle>{editId ? "Modifier le revenu" : "Nouveau revenu"}</SheetTitle></SheetHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-6">
                <div className="space-y-2"><Label>Montant (MAD)</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="0.00" /></div>
                <div className="space-y-2"><Label>Date</Label>
                  <Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-full justify-start text-left font-normal")}><CalendarIcon className="mr-2 h-4 w-4" />{format(date, "PPP", { locale: fr })}</Button></PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus className="p-3 pointer-events-auto" /></PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-1"><Label>Catégorie</Label><ManageChoices fieldType="revenue_category" label="Catégories revenus" /></div>
                  <AutocompleteInput fieldType="revenue_category" value={category} onChange={setCategory} placeholder="Ex: Consultation, Prothèse..." />
                </div>
                <div className="space-y-2"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes..." rows={2} /></div>
                <Button type="submit" className="w-full" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editId ? "Modifier" : "Enregistrer"}</Button>
              </form>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <Card className="glass-card">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : revenues.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">Aucun revenu enregistré.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {revenues.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{format(new Date(r.date), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="font-medium tabular-nums">{Number(r.amount).toLocaleString("fr-FR")} MAD</TableCell>
                    <TableCell className="text-sm">{r.category || "—"}</TableCell>
                    <TableCell className="text-sm truncate max-w-[200px]">{r.notes || "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
