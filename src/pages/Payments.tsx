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
import { toast } from "@/hooks/use-toast";
import { Plus, Eye, CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export default function Payments() {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [supplierSheet, setSupplierSheet] = useState(false);
  const [paymentSheet, setPaymentSheet] = useState(false);
  const [detailDialog, setDetailDialog] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Supplier form
  const [sName, setSName] = useState("");
  const [sType, setSType] = useState("fournisseur");
  const [sRib, setSRib] = useState("");
  const [sPhone, setSPhone] = useState("");

  // Payment form
  const [pSupplierId, setPSupplierId] = useState("");
  const [pAmount, setPAmount] = useState("");
  const [pDate, setPDate] = useState<Date>(new Date());
  const [pRef, setPRef] = useState("");
  const [pStatus, setPStatus] = useState("pending");

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const [sRes, pRes] = await Promise.all([
      supabase.from("suppliers").select("*").order("name"),
      supabase.from("payments").select("*, suppliers(name)").order("date", { ascending: false }),
    ]);
    setSuppliers(sRes.data || []);
    setPayments(pRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !sName.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("suppliers").insert({
      user_id: user.id, name: sName.trim(), type: sType, rib: sRib.trim() || null, phone: sPhone.trim() || null,
    });
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else {
      saveAutocomplete(user.id, "supplier_name", sName.trim());
      toast({ title: "Fournisseur ajouté" });
      setSName(""); setSRib(""); setSPhone(""); setSupplierSheet(false); fetchData();
    }
    setSaving(false);
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !pSupplierId || !pAmount) return;
    setSaving(true);
    const { error } = await supabase.from("payments").insert({
      user_id: user.id, supplier_id: pSupplierId, amount: parseFloat(pAmount),
      date: format(pDate, "yyyy-MM-dd"), reference: pRef.trim() || null, status: pStatus,
    });
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Paiement enregistré" });
      setPAmount(""); setPRef(""); setPStatus("pending"); setPaymentSheet(false); fetchData();
    }
    setSaving(false);
  };

  const viewSupplier = (s: any) => {
    setSelectedSupplier(s);
    setDetailDialog(true);
  };

  const supplierPayments = selectedSupplier ? payments.filter((p) => p.supplier_id === selectedSupplier.id) : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Paiements" description="Fournisseurs et prothésistes">
        <Sheet open={supplierSheet} onOpenChange={setSupplierSheet}>
          <SheetTrigger asChild><Button variant="outline" size="sm"><Plus className="mr-2 h-4 w-4" />Fournisseur</Button></SheetTrigger>
          <SheetContent>
            <SheetHeader><SheetTitle>Nouveau fournisseur</SheetTitle></SheetHeader>
            <form onSubmit={handleAddSupplier} className="space-y-4 mt-6">
              <div className="space-y-2"><Label>Nom</Label><AutocompleteInput fieldType="supplier_name" value={sName} onChange={setSName} placeholder="Nom du fournisseur" /></div>
              <div className="space-y-2"><Label>Type</Label>
                <Select value={sType} onValueChange={setSType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fournisseur">Fournisseur</SelectItem><SelectItem value="prothesiste">Prothésiste</SelectItem></SelectContent></Select>
              </div>
              <div className="space-y-2"><Label>RIB</Label><Input value={sRib} onChange={(e) => setSRib(e.target.value)} placeholder="RIB" /></div>
              <div className="space-y-2"><Label>Téléphone</Label><Input value={sPhone} onChange={(e) => setSPhone(e.target.value)} placeholder="Téléphone" /></div>
              <Button type="submit" className="w-full" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Ajouter</Button>
            </form>
          </SheetContent>
        </Sheet>
        <Sheet open={paymentSheet} onOpenChange={setPaymentSheet}>
          <SheetTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />Paiement</Button></SheetTrigger>
          <SheetContent>
            <SheetHeader><SheetTitle>Nouveau paiement</SheetTitle></SheetHeader>
            <form onSubmit={handleAddPayment} className="space-y-4 mt-6">
              <div className="space-y-2"><Label>Fournisseur</Label>
                <Select value={pSupplierId} onValueChange={setPSupplierId}><SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                  <SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Montant (MAD)</Label><Input type="number" step="0.01" value={pAmount} onChange={(e) => setPAmount(e.target.value)} required /></div>
              <div className="space-y-2"><Label>Date</Label>
                <Popover><PopoverTrigger asChild><Button variant="outline" className="w-full justify-start"><CalendarIcon className="mr-2 h-4 w-4" />{format(pDate, "PPP", { locale: fr })}</Button></PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={pDate} onSelect={(d) => d && setPDate(d)} initialFocus className="p-3 pointer-events-auto" /></PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2"><Label>Référence</Label><Input value={pRef} onChange={(e) => setPRef(e.target.value)} placeholder="Réf." /></div>
              <div className="space-y-2"><Label>Statut</Label>
                <Select value={pStatus} onValueChange={setPStatus}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="paid">Payé</SelectItem><SelectItem value="partial">Partiel</SelectItem><SelectItem value="pending">En attente</SelectItem></SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enregistrer</Button>
            </form>
          </SheetContent>
        </Sheet>
      </PageHeader>

      {/* Suppliers */}
      <Card className="glass-card">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Fournisseurs & Prothésistes</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="p-6 space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div> :
            suppliers.length === 0 ? <div className="p-12 text-center text-sm text-muted-foreground">Aucun fournisseur enregistré.</div> :
            <Table>
              <TableHeader><TableRow><TableHead>Nom</TableHead><TableHead>Type</TableHead><TableHead>Téléphone</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {suppliers.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-sm capitalize">{s.type === "prothesiste" ? "Prothésiste" : "Fournisseur"}</TableCell>
                    <TableCell className="text-sm">{s.phone || "—"}</TableCell>
                    <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => viewSupplier(s)}><Eye className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          }
        </CardContent>
      </Card>

      {/* Payments */}
      <Card className="glass-card">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Historique des paiements</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="p-6 space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div> :
            payments.length === 0 ? <div className="p-12 text-center text-sm text-muted-foreground">Aucun paiement.</div> :
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Fournisseur</TableHead><TableHead>Montant</TableHead><TableHead>Réf.</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm">{format(new Date(p.date), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="text-sm">{(p.suppliers as any)?.name || "—"}</TableCell>
                    <TableCell className="font-medium tabular-nums">{Number(p.amount).toLocaleString("fr-FR")} MAD</TableCell>
                    <TableCell className="text-sm">{p.reference || "—"}</TableCell>
                    <TableCell><StatusBadge status={p.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          }
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailDialog} onOpenChange={setDetailDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{selectedSupplier?.name}</DialogTitle></DialogHeader>
          {selectedSupplier && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Type :</span> {selectedSupplier.type === "prothesiste" ? "Prothésiste" : "Fournisseur"}</div>
                <div><span className="text-muted-foreground">Tél :</span> {selectedSupplier.phone || "—"}</div>
                <div className="col-span-2"><span className="text-muted-foreground">RIB :</span> {selectedSupplier.rib || "—"}</div>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">Historique ({supplierPayments.length})</h4>
                {supplierPayments.length === 0 ? <p className="text-sm text-muted-foreground">Aucun paiement</p> :
                  <div className="space-y-2 max-h-60 overflow-auto">
                    {supplierPayments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-2 rounded bg-muted/30 text-sm">
                        <span>{format(new Date(p.date), "dd/MM/yyyy")}</span>
                        <span className="tabular-nums font-medium">{Number(p.amount).toLocaleString("fr-FR")} MAD</span>
                        <StatusBadge status={p.status} />
                      </div>
                    ))}
                  </div>
                }
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
