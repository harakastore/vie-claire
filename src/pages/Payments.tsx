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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { AutocompleteInput, saveAutocomplete } from "@/components/AutocompleteInput";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Eye, CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = [
  "hsl(220, 60%, 42%)", "hsl(175, 35%, 48%)", "hsl(38, 70%, 50%)",
  "hsl(150, 50%, 45%)", "hsl(10, 70%, 52%)", "hsl(280, 40%, 50%)",
];

export default function Payments() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [detailPayment, setDetailPayment] = useState<any>(null);

  // Form
  const [supplierName, setSupplierName] = useState("");
  const [pAmount, setPAmount] = useState("");
  const [pDate, setPDate] = useState<Date>(new Date());
  const [pRef, setPRef] = useState("");
  const [pStatus, setPStatus] = useState("pending");
  const [invoiceCount, setInvoiceCount] = useState("");
  const [pNotes, setPNotes] = useState("");
  const [paidAmount, setPaidAmount] = useState("");

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("payments").select("*").order("date", { ascending: false });
    setPayments(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  const resetForm = () => {
    setSupplierName(""); setPAmount(""); setPDate(new Date()); setPRef(""); setPStatus("pending"); setInvoiceCount(""); setPNotes(""); setPaidAmount(""); setEditId(null);
  };

  const openEdit = (p: any) => {
    setEditId(p.id); setSupplierName(p.supplier_name || ""); setPAmount(String(p.amount));
    setPDate(new Date(p.date)); setPRef(p.reference || ""); setPStatus(p.status);
    setInvoiceCount(String(p.invoice_count || 0)); setPNotes(p.notes || "");
    setPaidAmount(String(p.paid_amount || 0));
    setSheetOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !supplierName.trim() || !pAmount) return;
    setSaving(true);
    const payload: any = {
      user_id: user.id, supplier_name: supplierName.trim(), amount: parseFloat(pAmount),
      paid_amount: parseFloat(paidAmount) || 0,
      date: format(pDate, "yyyy-MM-dd"), reference: pRef.trim() || null, status: pStatus,
      invoice_count: parseInt(invoiceCount) || 0, notes: pNotes.trim() || null,
    };
    const { error } = editId
      ? await supabase.from("payments").update(payload).eq("id", editId)
      : await supabase.from("payments").insert(payload);
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else {
      saveAutocomplete(user.id, "supplier_name", supplierName.trim());
      toast({ title: editId ? "Paiement modifié" : "Paiement enregistré" });
      resetForm(); setSheetOpen(false); fetchData();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("payments").delete().eq("id", id);
    toast({ title: "Transaction supprimée" }); fetchData();
  };

  // Stats
  const totalCredit = payments.filter((p) => p.status !== "paid").reduce((s, p) => s + (Number(p.amount) - Number(p.paid_amount || 0)), 0);

  // Pie data by supplier
  const supplierMap: Record<string, number> = {};
  payments.filter((p) => p.status !== "paid").forEach((p) => {
    const name = p.supplier_name || "Inconnu";
    supplierMap[name] = (supplierMap[name] || 0) + (Number(p.amount) - Number(p.paid_amount || 0));
  });
  const pieData = Object.entries(supplierMap).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Paiements" description="Historique des paiements fournisseurs & prothésistes">
        <Sheet open={sheetOpen} onOpenChange={(o) => { setSheetOpen(o); if (!o) resetForm(); }}>
          <SheetTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />Ajouter</Button></SheetTrigger>
          <SheetContent className="overflow-auto">
            <SheetHeader><SheetTitle>{editId ? "Modifier le paiement" : "Nouveau paiement"}</SheetTitle></SheetHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-6">
              <div className="space-y-2"><Label>Fournisseur / Prothésiste</Label>
                <AutocompleteInput fieldType="supplier_name" value={supplierName} onChange={setSupplierName} placeholder="Nom du fournisseur" />
              </div>
              <div className="space-y-2"><Label>Montant (MAD)</Label><Input type="number" step="0.01" value={pAmount} onChange={(e) => setPAmount(e.target.value)} required /></div>
              <div className="space-y-2"><Label>Montant payé (MAD)</Label><Input type="number" step="0.01" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} placeholder="0" /></div>
              {pAmount && (
                <div className="text-sm px-1">
                  Reste : <span className={cn("font-semibold tabular-nums", (parseFloat(pAmount) - (parseFloat(paidAmount) || 0)) > 0 ? "text-destructive" : "text-[hsl(var(--status-paid))]")}>{(parseFloat(pAmount) - (parseFloat(paidAmount) || 0)).toLocaleString("fr-FR")} MAD</span>
                </div>
              )}
              <div className="space-y-2"><Label>Date</Label>
                <Popover><PopoverTrigger asChild><Button variant="outline" className="w-full justify-start"><CalendarIcon className="mr-2 h-4 w-4" />{format(pDate, "PPP", { locale: fr })}</Button></PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={pDate} onSelect={(d) => d && setPDate(d)} initialFocus className="p-3 pointer-events-auto" /></PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2"><Label>Référence</Label><Input value={pRef} onChange={(e) => setPRef(e.target.value)} placeholder="Réf." /></div>
              <div className="space-y-2"><Label>Montant de facture reçu</Label><Input type="number" value={invoiceCount} onChange={(e) => setInvoiceCount(e.target.value)} placeholder="0" /></div>
              <div className="space-y-2"><Label>Statut</Label>
                <Select value={pStatus} onValueChange={setPStatus}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="paid">Payé</SelectItem><SelectItem value="partial">Partiel</SelectItem><SelectItem value="pending">En attente</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Notes</Label><Textarea value={pNotes} onChange={(e) => setPNotes(e.target.value)} placeholder="Notes..." rows={2} /></div>
              <Button type="submit" className="w-full" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editId ? "Modifier" : "Enregistrer"}</Button>
            </form>
          </SheetContent>
        </Sheet>
      </PageHeader>

      {/* Total */}
      <Card style={{ backgroundColor: "hsl(10, 70%, 62%)" }} className="border-0 shadow-md">
        <CardContent className="p-5">
          <p className="text-sm text-white/80">Total crédit fournisseurs</p>
          <p className="text-2xl font-semibold tabular-nums mt-1 text-white">{totalCredit.toLocaleString("fr-FR")} MAD</p>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {/* Payments Table */}
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Historique</CardTitle></CardHeader>
          <CardContent className="p-0">
            {loading ? <div className="p-6 space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div> :
              payments.length === 0 ? <div className="p-12 text-center text-sm text-muted-foreground">Aucun paiement.</div> :
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Date</TableHead><TableHead>Fournisseur</TableHead><TableHead>Montant</TableHead>
                  <TableHead>Payé</TableHead><TableHead>Reste</TableHead>
                  <TableHead>Facture reçue</TableHead><TableHead>Statut</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {payments.map((p) => {
                    const reste = Number(p.amount) - Number(p.paid_amount || 0);
                    return (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm">{format(new Date(p.date), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="text-sm">{p.supplier_name || "—"}</TableCell>
                      <TableCell className="font-medium tabular-nums">{Number(p.amount).toLocaleString("fr-FR")} MAD</TableCell>
                      <TableCell className="tabular-nums text-sm">{Number(p.paid_amount || 0).toLocaleString("fr-FR")} MAD</TableCell>
                      <TableCell className={cn("font-medium tabular-nums", reste > 0 ? "text-destructive" : "text-[hsl(var(--status-paid))]")}>{reste.toLocaleString("fr-FR")} MAD</TableCell>
                      <TableCell className="text-sm">{p.invoice_count || 0}</TableCell>
                      <TableCell><StatusBadge status={p.status} /></TableCell>
                      <TableCell className="text-right flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" onClick={() => setDetailPayment(p)}><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            }
          </CardContent>
        </Card>

        {/* Pie chart */}
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Répartition par fournisseur (dû)</CardTitle></CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">Aucun montant dû</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`${v.toLocaleString("fr-FR")} MAD`]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-3 mt-2">
                  {pieData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-1.5 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      {d.name}
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!detailPayment} onOpenChange={(o) => !o && setDetailPayment(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Détail de la transaction</DialogTitle></DialogHeader>
          {detailPayment && (() => {
            const reste = Number(detailPayment.amount) - Number(detailPayment.paid_amount || 0);
            return (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-muted-foreground">Fournisseur</span><p className="font-medium">{detailPayment.supplier_name || "—"}</p></div>
                  <div><span className="text-muted-foreground">Date</span><p>{format(new Date(detailPayment.date), "dd/MM/yyyy")}</p></div>
                  <div><span className="text-muted-foreground">Montant</span><p className="font-semibold tabular-nums">{Number(detailPayment.amount).toLocaleString("fr-FR")} MAD</p></div>
                  <div><span className="text-muted-foreground">Montant payé</span><p className="tabular-nums">{Number(detailPayment.paid_amount || 0).toLocaleString("fr-FR")} MAD</p></div>
                  <div><span className="text-muted-foreground">Reste</span><p className={cn("font-semibold tabular-nums", reste > 0 ? "text-destructive" : "text-[hsl(var(--status-paid))]")}>{reste.toLocaleString("fr-FR")} MAD</p></div>
                  <div><span className="text-muted-foreground">Statut</span><div className="mt-0.5"><StatusBadge status={detailPayment.status} /></div></div>
                  <div><span className="text-muted-foreground">Facture reçue</span><p>{detailPayment.invoice_count || 0}</p></div>
                  <div><span className="text-muted-foreground">Référence</span><p>{detailPayment.reference || "—"}</p></div>
                </div>
                {detailPayment.notes && (
                  <div><span className="text-muted-foreground">Notes</span><p className="mt-1 p-2 rounded bg-muted/30 text-sm">{detailPayment.notes}</p></div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
