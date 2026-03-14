import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectorBadge } from "@/components/SectorBadge";
import { useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Receipt, CreditCard, CheckSquare, ListTodo, TrendingDown, TrendingUp } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachWeekOfInterval, isWithinInterval } from "date-fns";
import { fr } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

const COLORS = [
  "hsl(220, 60%, 42%)", "hsl(175, 35%, 48%)", "hsl(38, 70%, 50%)",
  "hsl(150, 50%, 45%)", "hsl(10, 70%, 52%)", "hsl(280, 40%, 50%)",
];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sectorFilter, setSectorFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [credits, setCredits] = useState<any[]>([]);
  const [habits, setHabits] = useState<any[]>([]);
  const [habitLogs, setHabitLogs] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      supabase.from("expenses").select("*").gte("date", monthStart.toISOString().split("T")[0]).lte("date", monthEnd.toISOString().split("T")[0]),
      supabase.from("credits").select("*"),
      supabase.from("habits").select("*").eq("active", true),
      supabase.from("habit_logs").select("*").eq("month", now.getMonth() + 1).eq("year", now.getFullYear()),
      supabase.from("tasks").select("*").neq("status", "done"),
    ]).then(([expRes, credRes, habRes, logRes, taskRes]) => {
      setExpenses(expRes.data || []);
      setCredits(credRes.data || []);
      setHabits(habRes.data || []);
      setHabitLogs(logRes.data || []);
      setTasks(taskRes.data || []);
      setLoading(false);
    });
  }, [user]);

  const filteredExpenses = sectorFilter === "all" ? expenses : expenses.filter((e) => e.sector === sectorFilter);
  const totalExpenses = filteredExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalMonthlyCredits = credits.filter((c) => c.status === "active").reduce((s, c) => s + Number(c.monthly_payment), 0);
  const completedHabits = habitLogs.filter((l) => l.completed).length;
  const totalHabits = habits.length;
  const pendingTasks = tasks.length;

  // Weekly chart data
  const weeks = eachWeekOfInterval({ start: monthStart, end: monthEnd }, { weekStartsOn: 1 });
  const weeklyData = weeks.map((weekStart, i) => {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const weekExpenses = filteredExpenses.filter((e) => {
      const d = new Date(e.date);
      return isWithinInterval(d, { start: weekStart, end: weekEnd > monthEnd ? monthEnd : weekEnd });
    });
    return {
      name: `S${i + 1}`,
      perso: weekExpenses.filter((e) => e.sector === "perso").reduce((s, e) => s + Number(e.amount), 0),
      cabinet: weekExpenses.filter((e) => e.sector === "cabinet").reduce((s, e) => s + Number(e.amount), 0),
    };
  });

  // Category pie
  const categoryMap: Record<string, number> = {};
  filteredExpenses.forEach((e) => {
    const cat = e.category || "Autre";
    categoryMap[cat] = (categoryMap[cat] || 0) + Number(e.amount);
  });
  const pieData = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Tableau de bord" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-72 rounded-lg" />
          <Skeleton className="h-72 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Tableau de bord" description={`${format(now, "MMMM yyyy", { locale: fr })} — Vue d'ensemble`}>
        <Select value={sectorFilter} onValueChange={setSectorFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les secteurs</SelectItem>
            <SelectItem value="perso">Vie Perso</SelectItem>
            <SelectItem value="cabinet">Cabinet</SelectItem>
          </SelectContent>
        </Select>
      </PageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Dépenses du mois" value={`${totalExpenses.toLocaleString("fr-FR")} MAD`} icon={<Receipt className="h-5 w-5" />} onClick={() => navigate("/depenses")} />
        <KPICard title="Crédits mensuels" value={`${totalMonthlyCredits.toLocaleString("fr-FR")} MAD`} icon={<CreditCard className="h-5 w-5" />} onClick={() => navigate("/credits")} />
        <KPICard title="Habitudes" value={`${completedHabits}/${totalHabits}`} icon={<CheckSquare className="h-5 w-5" />} onClick={() => navigate("/habitudes")} />
        <KPICard title="Tâches en cours" value={String(pendingTasks)} icon={<ListTodo className="h-5 w-5" />} onClick={() => navigate("/engagements")} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Dépenses par semaine</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={weeklyData} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 13 }}
                  formatter={(v: number) => [`${v.toLocaleString("fr-FR")} MAD`]}
                />
                <Bar dataKey="perso" name="Perso" fill="hsl(175, 35%, 48%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cabinet" name="Cabinet" fill="hsl(220, 60%, 42%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Répartition par catégorie</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
                Aucune dépense ce mois
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`${v.toLocaleString("fr-FR")} MAD`]} />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="flex flex-wrap gap-3 mt-2">
              {pieData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  {d.name}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KPICard({ title, value, icon, onClick }: { title: string; value: string; icon: React.ReactNode; onClick?: () => void }) {
  return (
    <Card className="kpi-card cursor-pointer hover:bg-muted/40 transition-colors" onClick={onClick}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="text-muted-foreground">{icon}</div>
        </div>
        <p className="text-2xl font-semibold tabular-nums mt-3">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{title}</p>
      </CardContent>
    </Card>
  );
}
