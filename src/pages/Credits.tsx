import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AutocompleteInput, saveAutocomplete } from "@/components/AutocompleteInput";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const statusConfig: Record<string, { label: string; className: string }> = {
  en_cours: { label: "En cours", className: "bg-status-partial-bg text-status-partial border-[hsl(var(--status-partial-border))]" },
  rembourse: { label: "Remboursé", className: "bg-status-paid-bg text-status-paid border-[hsl(var(--status-paid-border))]" },
  partiel: { label: "Partiel", className: "bg-status-pending-bg text-status-pending border-[hsl(var(--status-pending-border))]" },
};

export default function Credits() {
  const { user } = useAuth();
  const [credits, setCredits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form
  const [personName, setPersonName] = useState("");
  const [creditType, setCreditType] = useState("they_owe");
  const [amount, setAmount] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [creditDate, setCreditDate] = useState<Date>(new Date());
  const [status, setStatus] = useState("en_cours");
  const [notes, setNotes] = useState("");

  const fetchCredits = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("credits").select("*").order("created_at", { ascending: false });
    setCredits(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchCredits(); }, [user]);

  const resetForm = () => { setPersonName(""); setCreditType("they_owe"); setAmount(""); setPaidAmount(""); setCreditDate(new Date()); setStatus("en_cours"); setNotes(""); setEditId(null); };

  const openEdit = (c: any) => {
    setEditId(c.id); setPersonName(c.person_name || c.lender || ""); setCreditType(c.credit_type || "they_owe");
    setAmount(String(c.amount || c.total_amount || 0)); setPaidAmount(String(c.paid_amount || 0));
    setCreditDate(new Date(c.credit_date || c.start_date || new Date()));
    setStatus(c.status); setNotes(c.notes || "");
    setSheetOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !personName.trim() || !amount) return;
    setSaving(true);
    const paidVal = parseFloat(paidAmount) || 0;
    const amountVal = parseFloat(amount);
    const payload: any = {
      person_name: personName.trim(), credit_type: creditType,
      amount: amountVal, paid_amount: paidVal,
      credit_date: format(creditDate, "yyyy-MM-dd"),
      status, notes: notes.trim() || null,
      name: personName.trim(), lender: personName.trim(), total_amount: amountVal,
      monthly_payment: 0, start_date: format(creditDate, "yyyy-MM-dd"), end_date: format(creditDate, "yyyy-MM-dd"),
    };
    let error;
    if (editId) {
      ({ error } = await supabase.from("credits").update(payload as any).eq("id", editId));
    } else {
      payload.user_id = user.id;
      ({ error } = await supabase.from("credits").insert(payload));
    }
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else {
      saveAutocomplete(user.id, "credit_person", personName.trim());
      toast({ title: editId ? "Crédit modifié" : "Crédit ajouté" });
      resetForm(); setSheetOpen(false); fetchCredits();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("credits").delete().eq("id", id);
    toast({ title: "Crédit supprimé" }); fetchCredits();
  };

  const quickStatus = async (id: string, newStatus: string) => {
    await supabase.from("credits").update({ status: newStatus } as any).eq("id", id);
    fetchCredits();
  };

  const totalOwedToMe = credits.filter((c) => (c.credit_type || "they_owe") === "they_owe" && c.status !== "rembourse").reduce((s, c) => s + (Number(c.amount || c.total_amount || 0) - Number(c.paid_amount || 0)), 0);
  const totalIOwe = credits.filter((c) => c.credit_type === "i_owe" && c.status !== "rembourse").reduce((s, c) => s + (Number(c.amount || c.total_amount || 0) - Number(c.paid_amount || 0)), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Crédits" description="Dettes et créances entre personnes">
        <Sheet open={sheetOpen} onOpenChange={(o) => { setSheetOpen(o); if (!o) resetForm(); }}>
          <SheetTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />Ajouter</Button></SheetTrigger>
          <SheetContent className="overflow-auto">
            <SheetHeader><SheetTitle>{editId ? "Modifier" : "Nouveau crédit"}</SheetTitle></SheetHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-6">
              <div className="space-y-2"><Label>Nom de la personne</Label>
                <AutocompleteInput fieldType="credit_person" value={personName} onChange={setPersonName} placeholder="Ex: Khalid, Papa..." />
              </div>
              <div className="space-y-2"><Label>Type</Label>
                <Select value={creditType} onValueChange={setCreditType}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="i_owe">Je dois</SelectItem><SelectItem value="they_owe">On me doit</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Montant (DH)</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
              <div className="space-y-2"><Label>Montant payé (DH)</Label><Input type="number" step="0.01" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} placeholder="0" /></div>
              {amount && <div className="text-sm">Reste : <span className={cn("font-semibold", (parseFloat(amount) - (parseFloat(paidAmount) || 0)) > 0 ? "text-destructive" : "text-green-600")}>{(parseFloat(amount) - (parseFloat(paidAmount) || 0)).toLocaleString("fr-FR")} DH</span></div>}
              <div className="space-y-2"><Label>Date</Label>
                <Popover><PopoverTrigger asChild><Button variant="outline" className="w-full justify-start"><CalendarIcon className="mr-2 h-4 w-4" />{format(creditDate, "PPP", { locale: fr })}</Button></PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={creditDate} onSelect={(d) => d && setCreditDate(d)} initialFocus className="p-3 pointer-events-auto" /></PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2"><Label>Statut</Label>
                <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="en_cours">En cours</SelectItem><SelectItem value="rembourse">Remboursé</SelectItem><SelectItem value="partiel">Partiel</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes..." rows={2} /></div>
              <Button type="submit" className="w-full" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editId ? "Modifier" : "Ajouter"}</Button>
            </form>
          </SheetContent>
        </Sheet>
      </PageHeader>

      {/* Totals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card style={{ backgroundColor: "hsl(var(--kpi-revenue))" }} className="border-0 shadow-md">
          <CardContent className="p-5">
            <p className="text-sm text-white/80">Total qu'on me doit</p>
            <p className="text-2xl font-semibold tabular-nums mt-1 text-white">{totalOwedToMe.toLocaleString("fr-FR")} DH</p>
          </CardContent>
        </Card>
        <Card style={{ backgroundColor: "hsl(var(--kpi-expenses))" }} className="border-0 shadow-md">
          <CardContent className="p-5">
            <p className="text-sm text-white/80">Total que je dois</p>
            <p className="text-2xl font-semibold tabular-nums mt-1 text-white">{totalIOwe.toLocaleString("fr-FR")} DH</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="glass-card">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : credits.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">Aucun crédit enregistré.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Personne</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Payé</TableHead>
                  <TableHead>Reste</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {credits.map((c) => {
                  const type = c.credit_type || "they_owe";
                  const st = statusConfig[c.status] || statusConfig.en_cours;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.person_name || c.lender || c.name}</TableCell>
                      <TableCell className="text-sm">{type === "i_owe" ? "Je dois" : "On me doit"}</TableCell>
                      <TableCell className="font-medium tabular-nums">{Number(c.amount || c.total_amount || 0).toLocaleString("fr-FR")} DH</TableCell>
                      <TableCell className="tabular-nums">{Number(c.paid_amount || 0).toLocaleString("fr-FR")} DH</TableCell>
                      <TableCell className={cn("font-medium tabular-nums", (Number(c.amount || 0) - Number(c.paid_amount || 0)) > 0 ? "text-destructive" : "text-green-600")}>{(Number(c.amount || c.total_amount || 0) - Number(c.paid_amount || 0)).toLocaleString("fr-FR")} DH</TableCell>
                      <TableCell className="text-sm">{c.credit_date || c.start_date ? format(new Date(c.credit_date || c.start_date), "dd/MM/yyyy") : "—"}</TableCell>
                      <TableCell>
                        <Select value={c.status} onValueChange={(v) => quickStatus(c.id, v)}>
                          <SelectTrigger className="w-28 h-8 text-xs border-0 p-0">
                            <Badge variant="outline" className={cn("text-xs", st.className)}>{st.label}</Badge>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="en_cours">En cours</SelectItem>
                            <SelectItem value="rembourse">Remboursé</SelectItem>
                            <SelectItem value="partiel">Partiel</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
