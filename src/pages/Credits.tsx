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
import { StatusBadge } from "@/components/StatusBadge";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Plus, CalendarIcon, Loader2 } from "lucide-react";
import { format, differenceInMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export default function Credits() {
  const { user } = useAuth();
  const [credits, setCredits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form
  const [name, setName] = useState("");
  const [lender, setLender] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [monthlyPayment, setMonthlyPayment] = useState("");
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("active");

  const fetchCredits = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("credits").select("*").order("created_at", { ascending: false });
    setCredits(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchCredits(); }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("credits").insert({
      user_id: user.id, name: name.trim(), lender: lender.trim(),
      total_amount: parseFloat(totalAmount), monthly_payment: parseFloat(monthlyPayment),
      start_date: format(startDate, "yyyy-MM-dd"), end_date: format(endDate, "yyyy-MM-dd"),
      notes: notes.trim() || null, status,
    });
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else { toast({ title: "Crédit ajouté" }); setName(""); setLender(""); setTotalAmount(""); setMonthlyPayment(""); setNotes(""); setSheetOpen(false); fetchCredits(); }
    setSaving(false);
  };

  const totalMonthly = credits.filter((c) => c.status === "active").reduce((s, c) => s + Number(c.monthly_payment), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Crédits" description="Suivi de vos crédits et emprunts">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />Ajouter</Button></SheetTrigger>
          <SheetContent className="overflow-auto">
            <SheetHeader><SheetTitle>Nouveau crédit</SheetTitle></SheetHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-6">
              <div className="space-y-2"><Label>Nom du crédit</Label><Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ex: Crédit immobilier" /></div>
              <div className="space-y-2"><Label>Organisme prêteur</Label><Input value={lender} onChange={(e) => setLender(e.target.value)} required placeholder="Ex: CIH Bank" /></div>
              <div className="space-y-2"><Label>Montant total (MAD)</Label><Input type="number" step="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} required /></div>
              <div className="space-y-2"><Label>Mensualité (MAD)</Label><Input type="number" step="0.01" value={monthlyPayment} onChange={(e) => setMonthlyPayment(e.target.value)} required /></div>
              <div className="space-y-2"><Label>Date de début</Label>
                <Popover><PopoverTrigger asChild><Button variant="outline" className="w-full justify-start"><CalendarIcon className="mr-2 h-4 w-4" />{format(startDate, "PPP", { locale: fr })}</Button></PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={startDate} onSelect={(d) => d && setStartDate(d)} initialFocus className="p-3 pointer-events-auto" /></PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2"><Label>Date de fin</Label>
                <Popover><PopoverTrigger asChild><Button variant="outline" className="w-full justify-start"><CalendarIcon className="mr-2 h-4 w-4" />{format(endDate, "PPP", { locale: fr })}</Button></PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={endDate} onSelect={(d) => d && setEndDate(d)} initialFocus className="p-3 pointer-events-auto" /></PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2"><Label>Statut</Label>
                <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="active">Actif</SelectItem><SelectItem value="settled">Soldé</SelectItem><SelectItem value="late">En retard</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes..." rows={2} /></div>
              <Button type="submit" className="w-full" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Ajouter</Button>
            </form>
          </SheetContent>
        </Sheet>
      </PageHeader>

      {/* Summary */}
      <Card className="kpi-card">
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground">Total mensualités actives</p>
          <p className="text-2xl font-semibold tabular-nums mt-1">{totalMonthly.toLocaleString("fr-FR")} MAD</p>
        </CardContent>
      </Card>

      {/* Credits list */}
      {loading ? <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}</div> :
        credits.length === 0 ? <div className="text-center py-12 text-sm text-muted-foreground">Aucun crédit enregistré.</div> :
        <div className="space-y-4">
          {credits.map((c) => {
            const totalMonths = differenceInMonths(new Date(c.end_date), new Date(c.start_date));
            const elapsedMonths = Math.max(0, differenceInMonths(new Date(), new Date(c.start_date)));
            const paidMonths = Math.min(elapsedMonths, totalMonths);
            const pctRepaid = totalMonths > 0 ? (paidMonths / totalMonths) * 100 : 0;
            const remainingCapital = Math.max(0, Number(c.total_amount) - (paidMonths * Number(c.monthly_payment)));
            const remainingMonths = Math.max(0, totalMonths - paidMonths);

            return (
              <Card key={c.id} className="glass-card">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{c.name}</h3>
                      <p className="text-xs text-muted-foreground">{c.lender}</p>
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div><span className="text-muted-foreground text-xs">Capital restant</span><p className="font-semibold tabular-nums">{remainingCapital.toLocaleString("fr-FR")} MAD</p></div>
                    <div><span className="text-muted-foreground text-xs">Mensualité</span><p className="tabular-nums">{Number(c.monthly_payment).toLocaleString("fr-FR")} MAD</p></div>
                    <div><span className="text-muted-foreground text-xs">Restant</span><p className="tabular-nums">{remainingMonths} mois</p></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={pctRepaid} className="h-1.5 flex-1" />
                    <span className="text-xs text-muted-foreground tabular-nums">{Math.round(pctRepaid)}%</span>
                  </div>
                  {c.notes && <p className="text-xs text-muted-foreground truncate">{c.notes}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      }
    </div>
  );
}
