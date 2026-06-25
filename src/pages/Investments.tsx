import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Check, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { format, startOfMonth } from "date-fns";

type Asset = { id: string; user_id: string; name: string; monthly_amount: number; day_of_month: number; currency: string; notes: string | null };
type Contrib = { id: string; user_id: string; asset_id: string; amount: number; contributed_at: string; note: string | null };

const monthKey = (d: string) => d.slice(0, 7); // yyyy-MM

export default function Investments() {
  const { user } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [contribs, setContribs] = useState<Contrib[]>([]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState("1");
  const [currency, setCurrency] = useState("MAD");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [a, c] = await Promise.all([
        (supabase.from as any)("dca_assets").select("*").order("created_at", { ascending: true }),
        (supabase.from as any)("dca_contributions").select("*").order("contributed_at", { ascending: true }),
      ]);
      setAssets((a.data as any) || []);
      setContribs((c.data as any) || []);
    })();
  }, [user]);

  const addAsset = async () => {
    if (!user || !name.trim() || !amount) return;
    const payload = {
      user_id: user.id,
      name: name.trim(),
      monthly_amount: parseFloat(amount.replace(",", ".")) || 0,
      day_of_month: Math.min(31, Math.max(1, parseInt(day) || 1)),
      currency: currency.trim() || "MAD",
    };
    const { data, error } = await (supabase.from as any)("dca_assets").insert(payload).select().single();
    if (error) { toast.error(error.message); return; }
    setAssets((p) => [...p, data as any]);
    setName(""); setAmount(""); setDay("1"); setCurrency("MAD");
    toast.success("Actif ajouté");
  };

  const removeAsset = async (id: string) => {
    if (!confirm("Supprimer cet actif et son historique ?")) return;
    const prev = assets;
    setAssets((p) => p.filter((x) => x.id !== id));
    const { error } = await (supabase.from as any)("dca_assets").delete().eq("id", id);
    if (error) { setAssets(prev); toast.error(error.message); }
  };

  const markPaid = async (a: Asset, customAmount?: number) => {
    if (!user) return;
    const amt = customAmount ?? Number(a.monthly_amount);
    const payload = { user_id: user.id, asset_id: a.id, amount: amt, contributed_at: format(new Date(), "yyyy-MM-dd") };
    const { data, error } = await (supabase.from as any)("dca_contributions").insert(payload).select().single();
    if (error) { toast.error(error.message); return; }
    setContribs((p) => [...p, data as any]);
    toast.success(`✅ ${amt} ${a.currency} investi sur ${a.name}`);
  };

  const removeContrib = async (id: string) => {
    const prev = contribs;
    setContribs((p) => p.filter((x) => x.id !== id));
    const { error } = await (supabase.from as any)("dca_contributions").delete().eq("id", id);
    if (error) { setContribs(prev); toast.error(error.message); }
  };

  const currentMonth = monthKey(format(new Date(), "yyyy-MM-dd"));

  const totals = useMemo(() => {
    const byCcy: Record<string, number> = {};
    contribs.forEach((c) => {
      const a = assets.find((x) => x.id === c.asset_id);
      const k = a?.currency || "MAD";
      byCcy[k] = (byCcy[k] || 0) + Number(c.amount);
    });
    return byCcy;
  }, [contribs, assets]);

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      <PageHeader title="Investissements DCA" description="Suivi mensuel de tes investissements par actif" />

      {Object.keys(totals).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {Object.entries(totals).map(([ccy, total]) => (
            <Card key={ccy}>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">Total investi ({ccy})</div>
                <div className="text-2xl font-semibold mt-1">{total.toLocaleString("fr-FR")} {ccy}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="mb-6">
        <CardHeader><CardTitle className="text-base">Ajouter un actif</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <Input placeholder="Nom (ex: BTC, S&P500...)" value={name} onChange={(e) => setName(e.target.value)} className="md:col-span-2" />
          <Input type="number" placeholder="Montant / mois" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Input type="number" min={1} max={31} placeholder="Jour du mois" value={day} onChange={(e) => setDay(e.target.value)} />
          <div className="flex gap-2">
            <Input placeholder="Devise" value={currency} onChange={(e) => setCurrency(e.target.value)} />
            <Button onClick={addAsset}><Plus className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      {assets.length === 0 && (
        <div className="text-center text-muted-foreground py-12">Aucun actif. Ajoute ton premier ci-dessus 💰</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {assets.map((a) => {
          const list = contribs.filter((c) => c.asset_id === a.id).sort((x, y) => x.contributed_at.localeCompare(y.contributed_at));
          const total = list.reduce((s, c) => s + Number(c.amount), 0);
          const paidThisMonth = list.some((c) => monthKey(c.contributed_at) === currentMonth);

          // Cumulative chart by month
          const byMonth: Record<string, number> = {};
          list.forEach((c) => { const k = monthKey(c.contributed_at); byMonth[k] = (byMonth[k] || 0) + Number(c.amount); });
          const months = Object.keys(byMonth).sort();
          let cum = 0;
          const chart = months.map((m) => { cum += byMonth[m]; return { mois: m.slice(2), cumulé: cum, mensuel: byMonth[m] }; });

          const expectedMonths = months.length || 1;
          const expected = Number(a.monthly_amount) * expectedMonths;
          const diff = total - expected;

          return (
            <Card key={a.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Wallet className="h-4 w-4" /> {a.name}
                    <Badge variant="outline">{Number(a.monthly_amount).toLocaleString("fr-FR")} {a.currency}/mois</Badge>
                    <Badge variant="secondary">le {a.day_of_month}</Badge>
                  </CardTitle>
                  <div className="text-sm mt-1">
                    <span className="text-muted-foreground">Total investi : </span>
                    <span className="font-semibold">{total.toLocaleString("fr-FR")} {a.currency}</span>
                    <span className="text-muted-foreground"> · {list.length} versement{list.length > 1 ? "s" : ""}</span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeAsset(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-3">
                  <Button
                    onClick={() => markPaid(a)}
                    disabled={paidThisMonth}
                    className={paidThisMonth ? "" : "bg-emerald-600 hover:bg-emerald-700 text-white"}
                    variant={paidThisMonth ? "outline" : "default"}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    {paidThisMonth ? "✓ Versé ce mois" : `Marquer payé (${Number(a.monthly_amount)} ${a.currency})`}
                  </Button>
                </div>

                {chart.length > 1 ? (
                  <div className="h-44 mb-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chart}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                        <Line type="monotone" dataKey="cumulé" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-20 flex items-center justify-center text-sm text-muted-foreground"><TrendingUp className="h-4 w-4 mr-2" />La courbe apparaît dès 2 mois de versements</div>
                )}

                {list.length > 0 && (
                  <div className="space-y-1 max-h-40 overflow-auto">
                    {[...list].reverse().map((c) => (
                      <div key={c.id} className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-muted/50">
                        <div className="flex items-center gap-2">
                          <Check className="h-3 w-3 text-emerald-500" />
                          <span className="font-medium">{Number(c.amount).toLocaleString("fr-FR")} {a.currency}</span>
                          <span className="text-muted-foreground text-xs">{format(new Date(c.contributed_at), "dd/MM/yyyy")}</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeContrib(c.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
