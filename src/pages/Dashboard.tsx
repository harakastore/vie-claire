import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, RadialBarChart, RadialBar } from "recharts";
import { Receipt, TrendingUp, TrendingDown, CalendarIcon, Target, Flame, Dumbbell, CheckCircle2, BookOpen } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachWeekOfInterval, endOfWeek, isWithinInterval, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

const PIE_COLORS = [
  "hsl(220, 70%, 55%)", "hsl(175, 45%, 50%)", "hsl(38, 75%, 55%)",
  "hsl(150, 55%, 48%)", "hsl(350, 65%, 55%)", "hsl(280, 50%, 58%)",
  "hsl(200, 60%, 50%)", "hsl(30, 80%, 55%)",
];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sectorFilter, setSectorFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [revenues, setRevenues] = useState<any[]>([]);
  const [credits, setCredits] = useState<any[]>([]);
  const [habits, setHabits] = useState<any[]>([]);
  const [habitLogs, setHabitLogs] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [dailyHabits, setDailyHabits] = useState<any[]>([]);
  const [dailyHabitLogs, setDailyHabitLogs] = useState<any[]>([]);
  const [dailyTasks, setDailyTasks] = useState<any[]>([]);
  const [weeklySports, setWeeklySports] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);

  const now = new Date();
  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(now));
  const [dateTo, setDateTo] = useState<Date>(endOfMonth(now));
  const todayStr = format(now, "yyyy-MM-dd");
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const fromStr = format(dateFrom, "yyyy-MM-dd");
    const toStr = format(dateTo, "yyyy-MM-dd");
    Promise.all([
      supabase.from("expenses").select("*").gte("date", fromStr).lte("date", toStr),
      supabase.from("revenues" as any).select("*").gte("date", fromStr).lte("date", toStr),
      supabase.from("credits").select("*"),
      supabase.from("habits").select("*").eq("active", true),
      supabase.from("habit_logs").select("*").eq("month", now.getMonth() + 1).eq("year", now.getFullYear()),
      supabase.from("payments").select("*"),
      supabase.from("daily_habits").select("*").eq("active", true),
      supabase.from("daily_habit_logs").select("*").eq("day_date", todayStr),
      supabase.from("daily_tasks").select("*").eq("day_date", todayStr),
      supabase.from("weekly_sports").select("*").eq("week_start", weekStart),
      supabase.from("goals").select("*"),
    ]).then(([expRes, revRes, credRes, habRes, logRes, payRes, dhRes, dhlRes, dtRes, wsRes, gRes]) => {
      setExpenses(expRes.data || []);
      setRevenues((revRes as any).data || []);
      setCredits(credRes.data || []);
      setHabits(habRes.data || []);
      setHabitLogs(logRes.data || []);
      setPayments(payRes.data || []);
      setDailyHabits(dhRes.data || []);
      setDailyHabitLogs(dhlRes.data || []);
      setDailyTasks(dtRes.data || []);
      setWeeklySports(wsRes.data || []);
      setGoals(gRes.data || []);
      setLoading(false);
    });
  }, [user, dateFrom, dateTo]);

  const filteredExpenses = sectorFilter === "all" ? expenses : expenses.filter((e) => e.sector === sectorFilter);
  const totalExpenses = filteredExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalRevenue = revenues.reduce((s, r) => s + Number(r.amount), 0);
  const netProfit = totalRevenue - totalExpenses;

  const completedHabits = habitLogs.filter((l) => l.completed).length;
  const totalHabits = habits.length;

  // Discipline metrics
  const dailyHabitsDone = dailyHabitLogs.filter((l) => l.completed).length;
  const dailyHabitsTotal = dailyHabits.length;
  const dailyTasksDone = dailyTasks.filter((t) => t.completed).length;
  const dailyTasksTotal = dailyTasks.length;
  const sportsDoneThisWeek = weeklySports.filter((s) => s.completed).length;
  const goalsInProgress = goals.filter((g) => g.status === "in_progress").length;
  const goalsDone = goals.filter((g) => g.status === "done").length;
  const goalsTotal = goals.length;

  // Discipline score (0-100)
  const disciplineFactors = [
    dailyHabitsTotal > 0 ? (dailyHabitsDone / dailyHabitsTotal) * 100 : 0,
    dailyTasksTotal > 0 ? (dailyTasksDone / dailyTasksTotal) * 100 : 0,
    totalHabits > 0 ? (completedHabits / totalHabits) * 100 : 0,
    7 > 0 ? (sportsDoneThisWeek / 7) * 100 : 0,
  ];
  const disciplineScore = disciplineFactors.length > 0
    ? Math.round(disciplineFactors.reduce((a, b) => a + b, 0) / disciplineFactors.length)
    : 0;

  const radialData = [{ name: "Discipline", value: disciplineScore, fill: disciplineScore >= 70 ? "hsl(150, 60%, 45%)" : disciplineScore >= 40 ? "hsl(38, 75%, 55%)" : "hsl(350, 65%, 55%)" }];

  // Weekly chart
  const weeks = eachWeekOfInterval({ start: dateFrom, end: dateTo }, { weekStartsOn: 1 });
  const weeklyData = weeks.map((weekStart, i) => {
    const wEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const wExpenses = filteredExpenses.filter((e) => {
      const d = new Date(e.date);
      return isWithinInterval(d, { start: weekStart, end: wEnd > dateTo ? dateTo : wEnd });
    });
    return {
      name: `S${i + 1}`,
      perso: wExpenses.filter((e) => e.sector === "perso").reduce((s, e) => s + Number(e.amount), 0),
      cabinet: wExpenses.filter((e) => e.sector === "cabinet").reduce((s, e) => s + Number(e.amount), 0),
    };
  });

  // Category pie
  const categoryMap: Record<string, number> = {};
  filteredExpenses.forEach((e) => {
    const cat = e.category || "Autre";
    categoryMap[cat] = (categoryMap[cat] || 0) + Number(e.amount);
  });
  const pieData = Object.entries(categoryMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Tableau de bord" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Tableau de bord" description={`${format(dateFrom, "d MMM", { locale: fr })} — ${format(dateTo, "d MMM yyyy", { locale: fr })}`}>
        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(dateFrom, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={(d) => d && setDateFrom(d)} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <span className="text-sm text-muted-foreground">→</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(dateTo, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={(d) => d && setDateTo(d)} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <Select value={sectorFilter} onValueChange={setSectorFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les secteurs</SelectItem>
              <SelectItem value="perso">Vie Perso</SelectItem>
              <SelectItem value="cabinet">Cabinet</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </PageHeader>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Chiffre d'affaires"
          value={`${totalRevenue.toLocaleString("fr-FR")} MAD`}
          icon={<TrendingUp className="h-5 w-5" />}
          variant="revenue"
          onClick={() => navigate("/depenses")}
        />
        <KPICard
          title="Profit net"
          value={`${netProfit.toLocaleString("fr-FR")} MAD`}
          icon={netProfit >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
          variant={netProfit >= 0 ? "profit" : "loss"}
          onClick={() => navigate("/depenses")}
        />
        <KPICard
          title="Dépenses"
          value={`${totalExpenses.toLocaleString("fr-FR")} MAD`}
          icon={<Receipt className="h-5 w-5" />}
          variant="expense"
          onClick={() => navigate("/depenses")}
        />
        <KPICard
          title="Habitudes"
          value={`${completedHabits}/${totalHabits}`}
          icon={<CheckCircle2 className="h-5 w-5" />}
          variant="habits"
          onClick={() => navigate("/habitudes")}
        />
      </div>

      {/* Discipline Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Discipline Score */}
        <Card className="border-0 bg-gradient-to-br from-card to-muted/30 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              Score Discipline
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center pb-4">
            <div className="relative w-40 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" startAngle={90} endAngle={-270} data={radialData} barSize={12}>
                  <RadialBar background={{ fill: "hsl(var(--muted))" }} dataKey="value" cornerRadius={10} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold">{disciplineScore}%</span>
                <span className="text-xs text-muted-foreground">Aujourd'hui</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Discipline Breakdown */}
        <Card className="lg:col-span-2 border-0 bg-gradient-to-br from-card to-muted/30 shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Discipline — Détails
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DisciplineRow
              label="Habitudes quotidiennes"
              icon={<BookOpen className="h-4 w-4" />}
              done={dailyHabitsDone}
              total={dailyHabitsTotal}
              color="hsl(220, 70%, 55%)"
            />
            <DisciplineRow
              label="Tâches du jour"
              icon={<CheckCircle2 className="h-4 w-4" />}
              done={dailyTasksDone}
              total={dailyTasksTotal}
              color="hsl(175, 45%, 50%)"
            />
            <DisciplineRow
              label="Habitudes mensuelles"
              icon={<Flame className="h-4 w-4" />}
              done={completedHabits}
              total={totalHabits}
              color="hsl(38, 75%, 55%)"
            />
            <DisciplineRow
              label="Sport cette semaine"
              icon={<Dumbbell className="h-4 w-4" />}
              done={sportsDoneThisWeek}
              total={7}
              color="hsl(150, 55%, 48%)"
            />
            <div className="pt-2 border-t border-border">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Objectifs atteints</span>
                <span className="font-semibold">{goalsDone}/{goalsTotal}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly expenses */}
        <Card className="border-0 bg-gradient-to-br from-card to-muted/30 shadow-lg overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Dépenses par semaine</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={weeklyData} barSize={18} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                    fontSize: 13,
                    boxShadow: "0 8px 30px -10px rgba(0,0,0,0.15)",
                  }}
                  formatter={(v: number) => [`${v.toLocaleString("fr-FR")} MAD`]}
                  cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                />
                <Bar dataKey="perso" name="Perso" fill="hsl(175, 45%, 50%)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="cabinet" name="Cabinet" fill="hsl(220, 70%, 55%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2 justify-center">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(175, 45%, 50%)" }} />
                Perso
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(220, 70%, 55%)" }} />
                Cabinet
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Category pie */}
        <Card className="border-0 bg-gradient-to-br from-card to-muted/30 shadow-lg overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Répartition par catégorie</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
                Aucune dépense ce mois
              </div>
            ) : (
              <div className="flex flex-col lg:flex-row items-center gap-4">
                <ResponsiveContainer width="100%" height={220} className="flex-shrink-0">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 12,
                        fontSize: 13,
                        boxShadow: "0 8px 30px -10px rgba(0,0,0,0.15)",
                      }}
                      formatter={(v: number) => [`${v.toLocaleString("fr-FR")} MAD`]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center lg:justify-start">
                  {pieData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-1.5 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-muted-foreground truncate max-w-[120px]">{d.name}</span>
                      <span className="font-medium tabular-nums">{d.value.toLocaleString("fr-FR")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* --- Sub-components --- */

type KPIVariant = "revenue" | "profit" | "loss" | "expense" | "habits";

const variantStyles: Record<KPIVariant, { bg: string; iconBg: string; iconColor: string }> = {
  revenue: {
    bg: "from-blue-500/10 to-blue-600/5 dark:from-blue-500/20 dark:to-blue-600/10",
    iconBg: "bg-blue-500/15 dark:bg-blue-500/25",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  profit: {
    bg: "from-emerald-500/10 to-emerald-600/5 dark:from-emerald-500/20 dark:to-emerald-600/10",
    iconBg: "bg-emerald-500/15 dark:bg-emerald-500/25",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  loss: {
    bg: "from-red-500/10 to-red-600/5 dark:from-red-500/20 dark:to-red-600/10",
    iconBg: "bg-red-500/15 dark:bg-red-500/25",
    iconColor: "text-red-600 dark:text-red-400",
  },
  expense: {
    bg: "from-orange-500/10 to-orange-600/5 dark:from-orange-500/20 dark:to-orange-600/10",
    iconBg: "bg-orange-500/15 dark:bg-orange-500/25",
    iconColor: "text-orange-600 dark:text-orange-400",
  },
  habits: {
    bg: "from-violet-500/10 to-violet-600/5 dark:from-violet-500/20 dark:to-violet-600/10",
    iconBg: "bg-violet-500/15 dark:bg-violet-500/25",
    iconColor: "text-violet-600 dark:text-violet-400",
  },
};

function KPICard({ title, value, icon, variant, onClick }: {
  title: string;
  value: string;
  icon: React.ReactNode;
  variant: KPIVariant;
  onClick?: () => void;
}) {
  const s = variantStyles[variant];
  return (
    <Card
      className={`cursor-pointer hover:scale-[1.02] transition-all duration-200 border-0 shadow-lg bg-gradient-to-br ${s.bg}`}
      onClick={onClick}
    >
      <CardContent className="p-4 sm:p-5">
        <div className={`w-9 h-9 rounded-xl ${s.iconBg} ${s.iconColor} flex items-center justify-center mb-3`}>
          {icon}
        </div>
        <p className="text-xl sm:text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{title}</p>
      </CardContent>
    </Card>
  );
}

function DisciplineRow({ label, icon, done, total, color }: {
  label: string;
  icon: React.ReactNode;
  done: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <span style={{ color }}>{icon}</span>
          <span>{label}</span>
        </div>
        <span className="text-sm font-semibold tabular-nums">{done}/{total}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
