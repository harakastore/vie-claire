import { useEffect, useState, useRef, DragEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, ChevronLeft, ChevronRight, Target, Calendar, Star, Pencil, ChevronDown, ChevronUp, Eye, EyeOff, Clock, Settings2, Dumbbell, BarChart3, ArrowRightLeft, Maximize2, Minimize2, CheckSquare, ListTodo } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay, subDays, addDays, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const DAY_NAMES = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

const BLOCKS = [
  { key: "fajr_dhuhr", label: "Fajr → Dhuhr", from: "fajr", to: "dhuhr", color: "hsl(200, 60%, 50%)" },
  { key: "dhuhr_asr", label: "Dhuhr → Asr", from: "dhuhr", to: "asr", color: "hsl(40, 70%, 50%)" },
  { key: "asr_maghrib", label: "Asr → Maghrib", from: "asr", to: "maghrib", color: "hsl(25, 70%, 55%)" },
  { key: "maghrib_isha", label: "Maghrib → Isha", from: "maghrib", to: "isha", color: "hsl(260, 50%, 55%)" },
  { key: "isha_fajr", label: "Isha → Fajr", from: "isha", to: "fajr", color: "hsl(230, 45%, 40%)" },
];

const DEFAULT_SALAT = { fajr: "06:00", dhuhr: "13:00", asr: "16:30", maghrib: "18:30", isha: "20:00" };

function calcDuration(from: string, to: string): string {
  const [h1, m1] = from.split(":").map(Number);
  const [h2, m2] = to.split(":").map(Number);
  let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (diff < 0) diff += 24 * 60;
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  return hours > 0 ? `${hours}h${mins > 0 ? mins.toString().padStart(2, "0") : ""}` : `${mins}min`;
}

export default function Goals() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const now = new Date();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(now, { weekStartsOn: 1 }));
  const [showAllDays, setShowAllDays] = useState(false);
  const [showGoals, setShowGoals] = useState(false);
  const [showSports, setShowSports] = useState(false);
  const [showDiscipline, setShowDiscipline] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [focusTasksOnly, setFocusTasksOnly] = useState(false);

  const GOAL_SECTIONS = [
    { key: "islam", label: "🕌 Islam", color: "hsl(160, 50%, 45%)" },
    { key: "business", label: "💼 Business", color: "hsl(220, 60%, 50%)" },
    { key: "cabinet", label: "🏥 Cabinet", color: "hsl(280, 50%, 50%)" },
    { key: "sport", label: "🏋️ Sport & Développement", color: "hsl(30, 70%, 50%)" },
  ];

  // Goals
  const [goals90, setGoals90] = useState<any[]>([]);
  const [goalsYearly, setGoalsYearly] = useState<any[]>([]);
  const [goalsMonthly, setGoalsMonthly] = useState<any[]>([]);
  const [goalsWeekly, setGoalsWeekly] = useState<any[]>([]);
  const [dailyTasks, setDailyTasks] = useState<any[]>([]);
  const [dailyHabits, setDailyHabits] = useState<any[]>([]);
  const [salatTimes, setSalatTimes] = useState<any>(null);
  const [weeklySports, setWeeklySports] = useState<any[]>([]);
  const [habitLogs, setHabitLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Drag state
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);

  // New inputs
  const [new90, setNew90] = useState("");
  const [newYearly, setNewYearly] = useState("");
  const [newMonthlyBySection, setNewMonthlyBySection] = useState<Record<string, string>>({});
  const [newWeeklyBySection, setNewWeeklyBySection] = useState<Record<string, string>>({});
  const [newPriority, setNewPriority] = useState("");
  const [newBlockTexts, setNewBlockTexts] = useState<Record<string, string>>({});
  const [newTaskText, setNewTaskText] = useState<Record<string, string>>({});
  const [newHabit, setNewHabit] = useState("");
  const [newHabitCategory, setNewHabitCategory] = useState<string>("personal");
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [editingHabitTitle, setEditingHabitTitle] = useState("");
  const [newDayPriority, setNewDayPriority] = useState<Record<string, string>>({});
  const [habitsSheetOpen, setHabitsSheetOpen] = useState(false);
  const [salatSheetOpen, setSalatSheetOpen] = useState(false);
  const [salatForm, setSalatForm] = useState(DEFAULT_SALAT);

  // Discipline filter
  const [disciplineFrom, setDisciplineFrom] = useState(() => format(subDays(now, 6), "yyyy-MM-dd"));
  const [disciplineTo, setDisciplineTo] = useState(() => format(now, "yyyy-MM-dd"));

  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: currentWeekStart, end: weekEnd });

  const st = salatTimes || DEFAULT_SALAT;

  const fetchAll = async () => {
    if (!user) return;
    setLoading(true);
    const wsStr = format(currentWeekStart, "yyyy-MM-dd");
    const weStr = format(weekEnd, "yyyy-MM-dd");

    const [g90, gy, gm, gw, dt, dh, stRes, spRes, hlRes] = await Promise.all([
      (supabase.from("goals" as any) as any).select("*").eq("type", "90day").order("created_at"),
      (supabase.from("goals" as any) as any).select("*").eq("type", "yearly").eq("year", currentYear).order("created_at"),
      (supabase.from("goals" as any) as any).select("*").eq("type", "monthly").eq("month", currentMonth).eq("year", currentYear).order("created_at"),
      (supabase.from("goals" as any) as any).select("*").eq("type", "weekly").eq("week_start", format(currentWeekStart, "yyyy-MM-dd")).order("created_at"),
      (supabase.from("daily_tasks" as any) as any).select("*").gte("day_date", wsStr).lte("day_date", weStr).order("created_at"),
      (supabase.from("daily_habits" as any) as any).select("*").eq("active", true).order("sort_order"),
      (supabase.from("salat_times" as any) as any).select("*").eq("month", currentMonth).eq("year", currentYear).maybeSingle(),
      (supabase.from("weekly_sports" as any) as any).select("*").eq("week_start", wsStr),
      (supabase.from("daily_habit_logs" as any) as any).select("*").gte("day_date", disciplineFrom).lte("day_date", disciplineTo),
    ]);
    setGoals90(g90.data || []);
    setGoalsYearly(gy.data || []);
    setGoalsMonthly(gm.data || []);
    setGoalsWeekly(gw.data || []);
    setDailyTasks(dt.data || []);
    setDailyHabits(dh.data || []);
    setWeeklySports(spRes.data || []);
    setHabitLogs(hlRes.data || []);
    if (stRes.data) {
      setSalatTimes(stRes.data);
      setSalatForm({ fajr: stRes.data.fajr?.slice(0, 5) || DEFAULT_SALAT.fajr, dhuhr: stRes.data.dhuhr?.slice(0, 5) || DEFAULT_SALAT.dhuhr, asr: stRes.data.asr?.slice(0, 5) || DEFAULT_SALAT.asr, maghrib: stRes.data.maghrib?.slice(0, 5) || DEFAULT_SALAT.maghrib, isha: stRes.data.isha?.slice(0, 5) || DEFAULT_SALAT.isha });
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [user, currentWeekStart, disciplineFrom, disciplineTo]);

  // Salat times save
  const saveSalatTimes = async () => {
    if (!user) return;
    const payload: any = { user_id: user.id, month: currentMonth, year: currentYear, ...salatForm };
    if (salatTimes?.id) {
      await (supabase.from("salat_times" as any) as any).update(salatForm as any).eq("id", salatTimes.id);
    } else {
      await (supabase.from("salat_times" as any) as any).insert(payload);
    }
    toast({ title: "Horaires de salat sauvegardés" });
    setSalatSheetOpen(false);
    fetchAll();
  };

  // Goal CRUD
  const addGoal = async (type: string, title: string, reset: () => void, category?: string) => {
    if (!user || !title.trim()) return;
    const tempId = crypto.randomUUID();
    const today = format(now, "yyyy-MM-dd");
    const in90 = format(addDays(now, 90), "yyyy-MM-dd");
    const payload: any = {
      id: tempId, user_id: user.id, type, title: title.trim(), status: "todo",
      month: type === "monthly" ? currentMonth : null,
      year: (type === "monthly" || type === "yearly") ? currentYear : null,
      week_start: type === "weekly" ? format(currentWeekStart, "yyyy-MM-dd") : null,
      start_date: type === "90day" ? today : null,
      end_date: type === "90day" ? in90 : null,
      category: category || "islam",
    };
    if (type === "90day") setGoals90((prev) => [...prev, payload]);
    else if (type === "yearly") setGoalsYearly((prev) => [...prev, payload]);
    else if (type === "monthly") setGoalsMonthly((prev) => [...prev, payload]);
    else if (type === "weekly") setGoalsWeekly((prev) => [...prev, payload]);
    reset();
    const { data, error } = await (supabase.from("goals" as any) as any).insert({ ...payload, id: undefined }).select().single();
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); fetchAll(); }
    else if (data) {
      const replace = (list: any[]) => list.map((g) => g.id === tempId ? data : g);
      setGoals90((prev) => replace(prev)); setGoalsYearly((prev) => replace(prev)); setGoalsMonthly((prev) => replace(prev)); setGoalsWeekly((prev) => replace(prev));
    }
  };

  const updateGoalStatus = async (id: string, status: string) => {
    const updateList = (list: any[]) => list.map((g) => g.id === id ? { ...g, status } : g);
    setGoals90((prev) => updateList(prev));
    setGoalsYearly((prev) => updateList(prev));
    setGoalsMonthly((prev) => updateList(prev));
    setGoalsWeekly((prev) => updateList(prev));
    await (supabase.from("goals" as any) as any).update({ status }).eq("id", id);
  };

  const deleteGoal = async (id: string) => {
    setGoals90((prev) => prev.filter((g) => g.id !== id));
    setGoalsYearly((prev) => prev.filter((g) => g.id !== id));
    setGoalsMonthly((prev) => prev.filter((g) => g.id !== id));
    setGoalsWeekly((prev) => prev.filter((g) => g.id !== id));
    await (supabase.from("goals" as any) as any).delete().eq("id", id);
  };

  // Restart a 90-day goal with new dates
  const restart90DayGoal = async (goal: any) => {
    if (!user) return;
    const today = format(now, "yyyy-MM-dd");
    const in90 = format(addDays(now, 90), "yyyy-MM-dd");
    await (supabase.from("goals" as any) as any).update({ start_date: today, end_date: in90, status: "in_progress" } as any).eq("id", goal.id);
    setGoals90((prev) => prev.map((g) => g.id === goal.id ? { ...g, start_date: today, end_date: in90, status: "in_progress" } : g));
    toast({ title: "Objectif 90 jours relancé", description: `Du ${format(now, "d MMM yyyy", { locale: fr })} au ${format(addDays(now, 90), "d MMM yyyy", { locale: fr })}` });
  };

  // Check if 90-day goal is expired
  const is90DayExpired = (goal: any) => {
    if (!goal.end_date) return false;
    return new Date(goal.end_date) < now;
  };

  const get90DayRemaining = (goal: any) => {
    if (!goal.end_date) return null;
    const end = new Date(goal.end_date);
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  // Daily tasks with block
  const addDailyTask = async (dayDate: string, block: string) => {
    if (!user) return;
    const key = `${dayDate}_${block}`;
    const text = newBlockTexts[key];
    if (!text?.trim()) return;
    const tempId = crypto.randomUUID();
    const tempTask = { id: tempId, user_id: user.id, title: text.trim(), day_date: dayDate, block, completed: false };
    setDailyTasks((prev) => [...prev, tempTask]);
    setNewBlockTexts((prev) => ({ ...prev, [key]: "" }));
    const { data, error } = await (supabase.from("daily_tasks" as any) as any).insert({ user_id: user.id, title: text.trim(), day_date: dayDate, block }).select().single();
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); fetchAll(); }
    else if (data) setDailyTasks((prev) => prev.map((t) => t.id === tempId ? data : t));
  };

  const addSimpleDailyTask = async (dayDate: string) => {
    if (!user) return;
    const text = newTaskText[dayDate];
    if (!text?.trim()) return;
    const tempId = crypto.randomUUID();
    const tempTask = { id: tempId, user_id: user.id, title: text.trim(), day_date: dayDate, block: "fajr_dhuhr", completed: false };
    setDailyTasks((prev) => [...prev, tempTask]);
    setNewTaskText((prev) => ({ ...prev, [dayDate]: "" }));
    const { data, error } = await (supabase.from("daily_tasks" as any) as any).insert({ user_id: user.id, title: text.trim(), day_date: dayDate, block: "fajr_dhuhr" }).select().single();
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); fetchAll(); }
    else if (data) setDailyTasks((prev) => prev.map((t) => t.id === tempId ? data : t));
  };

  const toggleDailyTask = async (id: string, completed: boolean) => {
    setDailyTasks((prev) => prev.map((t) => t.id === id ? { ...t, completed: !completed } : t));
    await (supabase.from("daily_tasks" as any) as any).update({ completed: !completed }).eq("id", id);
  };

  const deleteDailyTask = async (id: string) => {
    setDailyTasks((prev) => prev.filter((t) => t.id !== id));
    await (supabase.from("daily_tasks" as any) as any).delete().eq("id", id);
  };

  const moveTaskToBlock = async (id: string, newBlock: string) => {
    setDailyTasks((prev) => prev.map((t) => t.id === id ? { ...t, block: newBlock } : t));
    await (supabase.from("daily_tasks" as any) as any).update({ block: newBlock } as any).eq("id", id);
  };

  // Move task to another day (drag & drop)
  const moveTaskToDay = async (taskId: string, newDate: string) => {
    setDailyTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, day_date: newDate } : t));
    await (supabase.from("daily_tasks" as any) as any).update({ day_date: newDate } as any).eq("id", taskId);
  };

  // Drag handlers
  const handleDragStart = (e: DragEvent, taskId: string) => {
    setDragTaskId(taskId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", taskId);
  };

  const handleDragOver = (e: DragEvent, dateStr: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverDay(dateStr);
  };

  const handleDragLeave = () => {
    setDragOverDay(null);
  };

  const handleDrop = (e: DragEvent, dateStr: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain") || dragTaskId;
    if (taskId) {
      moveTaskToDay(taskId, dateStr);
    }
    setDragTaskId(null);
    setDragOverDay(null);
  };

  const addDailyHabit = async () => {
    if (!user || !newHabit.trim()) return;
    const tempId = crypto.randomUUID();
    const temp = { id: tempId, user_id: user.id, title: newHabit.trim(), sort_order: dailyHabits.length, active: true };
    setDailyHabits((prev) => [...prev, temp]);
    setNewHabit("");
    const { data, error } = await (supabase.from("daily_habits" as any) as any).insert({
      user_id: user.id, title: newHabit.trim(), sort_order: dailyHabits.length,
    }).select().single();
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); fetchAll(); }
    else if (data) setDailyHabits((prev) => prev.map((h) => h.id === tempId ? data : h));
  };

  const updateDailyHabit = async (id: string, title: string) => {
    if (!title.trim()) return;
    setDailyHabits((prev) => prev.map((h) => h.id === id ? { ...h, title: title.trim() } : h));
    setEditingHabitId(null);
    await (supabase.from("daily_habits" as any) as any).update({ title: title.trim() } as any).eq("id", id);
  };

  const deleteDailyHabit = async (id: string) => {
    setDailyHabits((prev) => prev.filter((h) => h.id !== id));
    await (supabase.from("daily_habits" as any) as any).delete().eq("id", id);
  };

  // Habit log toggle
  const toggleHabitLog = async (habitId: string, dayDate: string) => {
    if (!user) return;
    const existing = habitLogs.find((l: any) => l.habit_id === habitId && l.day_date === dayDate);
    if (existing) {
      setHabitLogs((prev) => prev.map((l) => l.id === existing.id ? { ...l, completed: !existing.completed } : l));
      await (supabase.from("daily_habit_logs" as any) as any).update({ completed: !existing.completed } as any).eq("id", existing.id);
    } else {
      const tempId = crypto.randomUUID();
      setHabitLogs((prev) => [...prev, { id: tempId, habit_id: habitId, day_date: dayDate, completed: true, user_id: user.id }]);
      const { data } = await (supabase.from("daily_habit_logs" as any) as any).insert({ user_id: user.id, habit_id: habitId, day_date: dayDate, completed: true }).select().single();
      if (data) setHabitLogs((prev) => prev.map((l) => l.id === tempId ? data : l));
    }
  };

  const isHabitCompleted = (habitId: string, dayDate: string) => {
    return habitLogs.some((l: any) => l.habit_id === habitId && l.day_date === dayDate && l.completed);
  };

  // Sports program
  const saveSportsProgram = async (dayIndex: number, program: string) => {
    if (!user) return;
    const wsStr = format(currentWeekStart, "yyyy-MM-dd");
    const existing = weeklySports.find((s: any) => s.day_index === dayIndex && s.id);
    if (existing) {
      await (supabase.from("weekly_sports" as any) as any).update({ program } as any).eq("id", existing.id);
    } else {
      const { data } = await (supabase.from("weekly_sports" as any) as any).insert({ user_id: user.id, week_start: wsStr, day_index: dayIndex, program }).select().single();
      if (data) setWeeklySports((prev) => prev.map((s) => s.day_index === dayIndex && !s.id ? data : s));
    }
  };

  const BASAL_KCAL = 2000;

  const saveSportsKcal = async (dayIndex: number, field: "kcal_eaten" | "kcal_burned", value: number) => {
    if (!user) return;
    const wsStr = format(currentWeekStart, "yyyy-MM-dd");
    const existing = weeklySports.find((s: any) => s.day_index === dayIndex && s.id);
    if (existing) {
      await (supabase.from("weekly_sports" as any) as any).update({ [field]: value } as any).eq("id", existing.id);
    } else {
      const payload: any = { user_id: user.id, week_start: wsStr, day_index: dayIndex, program: "", [field]: value };
      const { data } = await (supabase.from("weekly_sports" as any) as any).insert(payload).select().single();
      if (data) setWeeklySports((prev) => prev.map((s) => s.day_index === dayIndex && !s.id ? data : s));
    }
  };

  const toggleSportCompleted = async (dayIndex: number) => {
    const existing = weeklySports.find((s: any) => s.day_index === dayIndex);
    const newCompleted = !(existing?.completed);
    if (existing) {
      setWeeklySports((prev) => prev.map((s) => s.day_index === dayIndex ? { ...s, completed: newCompleted } : s));
      if (existing.id) {
        await (supabase.from("weekly_sports" as any) as any).update({ completed: newCompleted } as any).eq("id", existing.id);
      }
    } else {
      if (!user) return;
      const wsStr = format(currentWeekStart, "yyyy-MM-dd");
      const temp = { day_index: dayIndex, program: "", completed: true, user_id: user.id, week_start: wsStr };
      setWeeklySports((prev) => [...prev, temp]);
      const { data } = await (supabase.from("weekly_sports" as any) as any).insert({ user_id: user.id, week_start: wsStr, day_index: dayIndex, program: "", completed: true }).select().single();
      if (data) setWeeklySports((prev) => prev.map((s) => s.day_index === dayIndex && !s.id ? data : s));
    }
  };

  const visibleDays = isMobile && !showAllDays
    ? weekDays.filter((d) => isSameDay(d, now))
    : weekDays;

  // Navigate expanded day
  const navigateExpandedDay = (direction: number) => {
    if (!expandedDay) return;
    const currentIndex = weekDays.findIndex((d) => format(d, "yyyy-MM-dd") === expandedDay);
    const newIndex = currentIndex + direction;
    if (newIndex >= 0 && newIndex < weekDays.length) {
      setExpandedDay(format(weekDays[newIndex], "yyyy-MM-dd"));
    }
  };

  const expandedDayIndex = expandedDay ? weekDays.findIndex((d) => format(d, "yyyy-MM-dd") === expandedDay) : -1;

  // === MOBILE: Day card with salat blocks ===
  const renderMobileDayCard = (day: Date) => {
    const dateStr = format(day, "yyyy-MM-dd");
    const isToday = isSameDay(day, now);
    const dayTasks = dailyTasks.filter((t: any) => t.day_date === dateStr);
    const dayIndex = weekDays.findIndex((d) => isSameDay(d, day));

    return (
      <Card key={dateStr} className={cn(
        "overflow-hidden transition-all",
        isToday ? "border-primary border-2 shadow-lg" : "border-border/50"
      )}>
        <div className={cn(
          "px-4 py-3 flex items-center justify-between",
          isToday ? "bg-primary/10" : "bg-muted/30"
        )}>
          <div className="flex items-center gap-2">
            <span className={cn("text-base font-bold", isToday ? "text-primary" : "text-foreground")}>
              {DAY_NAMES[dayIndex]}
            </span>
            <span className="text-lg font-bold tabular-nums">{format(day, "d", { locale: fr })}</span>
          </div>
          <div className="flex items-center gap-1">
            {isToday && (
              <span className="text-[10px] font-medium bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                Aujourd'hui
              </span>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpandedDay(expandedDay === dateStr ? null : dateStr)}>
              {expandedDay === dateStr ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <CardContent className="p-0">
          {/* Non-négociable habits with light blue background */}
          {dailyHabits.length > 0 && (
            <div className="px-4 py-3 border-b border-dashed" style={{ backgroundColor: "hsl(200, 70%, 95%)" }}>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                🔒 NON NÉGOCIABLE
              </p>
              {dailyHabits.map((h: any) => (
                <div key={h.id} className="flex items-center gap-2 py-0.5">
                  <Checkbox
                    checked={isHabitCompleted(h.id, dateStr)}
                    onCheckedChange={() => toggleHabitLog(h.id, dateStr)}
                    className="h-4 w-4"
                  />
                  <span className={cn("text-sm font-medium", isHabitCompleted(h.id, dateStr) && "line-through text-muted-foreground")}>{h.title}</span>
                </div>
              ))}
            </div>
          )}

          {BLOCKS.map((block) => {
            const blockTasks = dayTasks.filter((t: any) => (t.block || "fajr_dhuhr") === block.key);
            const fromTime = (st[block.from as keyof typeof st] || "").toString().slice(0, 5);
            const toTime = (st[block.to as keyof typeof st] || "").toString().slice(0, 5);
            const duration = fromTime && toTime ? calcDuration(fromTime, toTime) : "";
            const inputKey = `${dateStr}_${block.key}`;

            return (
              <div key={block.key} className="border-b last:border-b-0">
                <div className="px-4 py-2 flex items-center justify-between" style={{ backgroundColor: `${block.color}15` }}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: block.color }} />
                    <span className="text-xs font-semibold" style={{ color: block.color }}>{block.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{fromTime} — {toTime}</span>
                    {duration && <span className="font-semibold ml-1">({duration})</span>}
                  </div>
                </div>
                <div className="px-4 py-2 space-y-1.5 min-h-[40px]">
                  {blockTasks.map((t: any) => (
                    <div key={t.id} className="flex items-start gap-2 group">
                      <Checkbox checked={t.completed} onCheckedChange={() => toggleDailyTask(t.id, t.completed)} className="mt-0.5 h-4 w-4" />
                      <span className={cn("text-sm flex-1 leading-snug", t.completed && "line-through text-muted-foreground")}>{t.title}</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="opacity-0 group-hover:opacity-100 shrink-0 text-muted-foreground hover:text-foreground">
                            <ArrowRightLeft className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {BLOCKS.filter((b) => b.key !== block.key).map((b) => (
                            <DropdownMenuItem key={b.key} onClick={() => moveTaskToBlock(t.id, b.key)}>
                              <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: b.color }} />
                              {b.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <button onClick={() => deleteDailyTask(t.id)} className="opacity-0 group-hover:opacity-100 text-destructive shrink-0">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <Input
                    placeholder="+ tâche"
                    value={newBlockTexts[inputKey] || ""}
                    onChange={(e) => setNewBlockTexts((prev) => ({ ...prev, [inputKey]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && addDailyTask(dateStr, block.key)}
                    className="h-7 text-xs border-dashed bg-transparent"
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
  };

  // === PC: Day card ===
  const renderDesktopDayCard = (day: Date) => {
    const dateStr = format(day, "yyyy-MM-dd");
    const isToday = isSameDay(day, now);
    const dayTasks = dailyTasks.filter((t: any) => t.day_date === dateStr);
    const dayIndex = weekDays.findIndex((d) => isSameDay(d, day));
    const isExpanded = expandedDay === dateStr;
    const isDragOver = dragOverDay === dateStr;

    if (isExpanded) {
      return (
        <Card key={dateStr} className="overflow-hidden border-primary border-2 shadow-lg col-span-7">
          <div className="px-6 py-4 flex items-center justify-between bg-primary/10">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-8 w-8" disabled={expandedDayIndex <= 0} onClick={() => navigateExpandedDay(-1)}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <span className="text-xl font-bold text-primary">{DAY_NAMES[dayIndex]}</span>
              <span className="text-2xl font-bold tabular-nums">{format(day, "d", { locale: fr })}</span>
              {isToday && (
                <span className="text-xs font-medium bg-primary text-primary-foreground px-2.5 py-1 rounded-full">
                  Aujourd'hui
                </span>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8" disabled={expandedDayIndex >= 6} onClick={() => navigateExpandedDay(1)}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8" onClick={() => setSalatSheetOpen(true)}>
                <Settings2 className="h-3.5 w-3.5 mr-1" /> Horaires Salat
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpandedDay(null)}>
                <Minimize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <CardContent className="p-0">
            {dailyHabits.length > 0 && (
              <div className="px-6 py-4 border-b border-dashed" style={{ backgroundColor: "hsl(200, 70%, 95%)" }}>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  🔒 NON NÉGOCIABLE
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {dailyHabits.map((h: any) => (
                    <div key={h.id} className="flex items-center gap-2 py-0.5">
                      <Checkbox
                        checked={isHabitCompleted(h.id, dateStr)}
                        onCheckedChange={() => toggleHabitLog(h.id, dateStr)}
                        className="h-4 w-4"
                      />
                      <span className={cn("text-sm font-medium", isHabitCompleted(h.id, dateStr) && "line-through text-muted-foreground")}>{h.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5">
              {BLOCKS.map((block) => {
                const blockTasks = dayTasks.filter((t: any) => (t.block || "fajr_dhuhr") === block.key);
                const fromTime = (st[block.from as keyof typeof st] || "").toString().slice(0, 5);
                const toTime = (st[block.to as keyof typeof st] || "").toString().slice(0, 5);
                const duration = fromTime && toTime ? calcDuration(fromTime, toTime) : "";
                const inputKey = `${dateStr}_${block.key}`;

                return (
                  <div key={block.key} className="border-b md:border-b-0 md:border-r last:border-r-0">
                    <div className="px-4 py-2.5 flex items-center justify-between" style={{ backgroundColor: `${block.color}15` }}>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: block.color }} />
                        <span className="text-xs font-semibold" style={{ color: block.color }}>{block.label}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{fromTime} — {toTime}</span>
                        {duration && <span className="font-semibold ml-1">({duration})</span>}
                      </div>
                    </div>
                    <div className="px-4 py-3 space-y-2 min-h-[100px]">
                      {blockTasks.map((t: any) => (
                        <div key={t.id} className="flex items-start gap-2 group">
                          <Checkbox checked={t.completed} onCheckedChange={() => toggleDailyTask(t.id, t.completed)} className="mt-0.5 h-4 w-4" />
                          <span className={cn("text-sm flex-1 leading-snug", t.completed && "line-through text-muted-foreground")}>{t.title}</span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="opacity-0 group-hover:opacity-100 shrink-0 text-muted-foreground hover:text-foreground">
                                <ArrowRightLeft className="h-3.5 w-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {BLOCKS.filter((b) => b.key !== block.key).map((b) => (
                                <DropdownMenuItem key={b.key} onClick={() => moveTaskToBlock(t.id, b.key)}>
                                  <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: b.color }} />
                                  {b.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <button onClick={() => deleteDailyTask(t.id)} className="opacity-0 group-hover:opacity-100 text-destructive shrink-0">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      <Input
                        placeholder="+ tâche"
                        value={newBlockTexts[inputKey] || ""}
                        onChange={(e) => setNewBlockTexts((prev) => ({ ...prev, [inputKey]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && addDailyTask(dateStr, block.key)}
                        className="h-7 text-xs border-dashed bg-transparent"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card
        key={dateStr}
        className={cn(
          "overflow-hidden transition-all",
          isToday ? "border-primary border-2 shadow-lg" : "border-border/50",
          isDragOver && "ring-2 ring-primary ring-offset-2"
        )}
        onDragOver={(e) => handleDragOver(e as any, dateStr)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e as any, dateStr)}
      >
        <button
          type="button"
          onClick={() => setExpandedDay(dateStr)}
          className={cn(
            "px-4 py-3 flex items-center justify-between w-full text-left cursor-pointer hover:opacity-80 transition-opacity",
            isToday ? "bg-primary/10" : "bg-muted/30"
          )}
          title="Cliquer pour vue détaillée avec time-blocking"
        >
          <div className="flex items-center gap-2">
            <span className={cn("text-base font-bold", isToday ? "text-primary" : "text-foreground")}>
              {DAY_NAMES[dayIndex]}
            </span>
            <span className="text-lg font-bold tabular-nums">{format(day, "d", { locale: fr })}</span>
          </div>
          <div className="flex items-center gap-1">
            {isToday && (
              <span className="text-[10px] font-medium bg-primary text-primary-foreground px-2 py-0.5 rounded-full mr-1">
                Aujourd'hui
              </span>
            )}
            <Maximize2 className="h-4 w-4 text-muted-foreground" />
          </div>
        </button>

        <CardContent className="p-3 space-y-1.5">
          {/* Non-négociable habits with light blue bg */}
          {dailyHabits.length > 0 && (
            <div className="pb-2 mb-2 border-b border-dashed rounded-md px-2 py-1.5" style={{ backgroundColor: "hsl(200, 70%, 95%)" }}>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1">🔒 NON NÉGOCIABLE</p>
              {dailyHabits.map((h: any) => (
                <div key={h.id} className="flex items-center gap-2 py-0.5">
                  <Checkbox
                    checked={isHabitCompleted(h.id, dateStr)}
                    onCheckedChange={() => toggleHabitLog(h.id, dateStr)}
                    className="h-3.5 w-3.5"
                  />
                  <span className={cn("text-xs font-medium", isHabitCompleted(h.id, dateStr) && "line-through text-muted-foreground")}>{h.title}</span>
                </div>
              ))}
            </div>
          )}

          {/* All tasks flat - draggable */}
          {dayTasks.map((t: any) => (
            <div
              key={t.id}
              className="flex items-start gap-2 group cursor-grab active:cursor-grabbing"
              draggable
              onDragStart={(e) => handleDragStart(e as any, t.id)}
            >
              <Checkbox checked={t.completed} onCheckedChange={() => toggleDailyTask(t.id, t.completed)} className="mt-0.5 h-4 w-4" />
              <span className={cn("text-sm flex-1 leading-snug", t.completed && "line-through text-muted-foreground")}>{t.title}</span>
              <button onClick={() => deleteDailyTask(t.id)} className="opacity-0 group-hover:opacity-100 text-destructive shrink-0">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <Input
            placeholder="+ tâche"
            value={newTaskText[dateStr] || ""}
            onChange={(e) => setNewTaskText((prev) => ({ ...prev, [dateStr]: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && addSimpleDailyTask(dateStr)}
            className="h-7 text-xs border-dashed bg-transparent"
          />
        </CardContent>
      </Card>
    );
  };

  // Discipline date range days
  const disciplineDays = (() => {
    try {
      const from = parseISO(disciplineFrom);
      const to = parseISO(disciplineTo);
      return eachDayOfInterval({ start: from, end: to });
    } catch { return []; }
  })();

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Objectifs & Tâches" />
        <div className="grid gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Objectifs & Tâches" description="Planifiez vos objectifs et tâches quotidiennes" />

      {/* Focus tasks only button */}
      <Button
        variant={focusTasksOnly ? "default" : "outline"}
        className="w-full justify-between"
        onClick={() => setFocusTasksOnly(!focusTasksOnly)}
      >
        <span className="flex items-center gap-2">
          <ListTodo className="h-4 w-4" />
          {focusTasksOnly ? "Afficher tout" : "Voir uniquement les tâches quotidiennes"}
        </span>
        {focusTasksOnly ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </Button>

      {!focusTasksOnly && (
        <>
          {/* Toggle goals visibility */}
          <Button variant="outline" className="w-full justify-between" onClick={() => setShowGoals(!showGoals)}>
            <span className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Objectifs (Annuel, 90 jours, mois, semaine)
            </span>
            {showGoals ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>

          {showGoals && (
            <>
              {/* Annual goals 2026 */}
              <Card className="glass-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" style={{ color: "hsl(var(--kpi-expenses))" }} />
                    🎯 Objectifs Annuels {currentYear}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {goalsYearly.map((g: any) => (
                    <div key={g.id} className="flex items-center gap-2 group">
                      <Select value={g.status} onValueChange={(v) => updateGoalStatus(g.id, v)}>
                        <SelectTrigger className="w-24 h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todo">À faire</SelectItem>
                          <SelectItem value="in_progress">En cours</SelectItem>
                          <SelectItem value="achieved">Atteint</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className={cn("flex-1 text-sm", g.status === "achieved" && "line-through text-muted-foreground")}>{g.title}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => deleteGoal(g.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                  ))}
                  <div className="flex gap-2 mt-2">
                    <Input placeholder="Nouvel objectif annuel..." value={newYearly} onChange={(e) => setNewYearly(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addGoal("yearly", newYearly, () => setNewYearly(""))} className="h-8 text-sm" />
                    <Button size="sm" variant="outline" className="h-8" onClick={() => addGoal("yearly", newYearly, () => setNewYearly(""))}><Plus className="h-3.5 w-3.5" /></Button>
                  </div>
                </CardContent>
              </Card>

              {/* 90-day goals with dates */}
              <Card className="glass-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Target className="h-4 w-4" style={{ color: "hsl(var(--kpi-credits))" }} />
                    Objectifs 90 jours
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {goals90.map((g: any) => {
                    const remaining = get90DayRemaining(g);
                    const expired = is90DayExpired(g);
                    return (
                      <div key={g.id} className="space-y-1">
                        <div className="flex items-center gap-2 group">
                          <Select value={g.status} onValueChange={(v) => updateGoalStatus(g.id, v)}>
                            <SelectTrigger className="w-24 h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="todo">À faire</SelectItem>
                              <SelectItem value="in_progress">En cours</SelectItem>
                              <SelectItem value="achieved">Atteint</SelectItem>
                            </SelectContent>
                          </Select>
                          <span className={cn("flex-1 text-sm", g.status === "achieved" && "line-through text-muted-foreground")}>{g.title}</span>
                          {expired && (
                            <Button size="sm" variant="outline" className="h-7 text-[10px] border-amber-400 text-amber-600 hover:bg-amber-50" onClick={() => restart90DayGoal(g)}>
                              🔄 Relancer 90j
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => deleteGoal(g.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                        </div>
                        {g.start_date && g.end_date && (
                          <div className="flex items-center gap-2 ml-[104px] text-[10px]">
                            <span className="text-muted-foreground">
                              📅 {format(new Date(g.start_date), "d MMM yyyy", { locale: fr })} → {format(new Date(g.end_date), "d MMM yyyy", { locale: fr })}
                            </span>
                            {remaining !== null && !expired && (
                              <span className={cn(
                                "font-bold px-1.5 py-0.5 rounded-full",
                                remaining <= 7 ? "bg-red-100 text-red-600" : remaining <= 30 ? "bg-amber-100 text-amber-600" : "bg-green-100 text-green-600"
                              )}>
                                {remaining}j restants
                              </span>
                            )}
                            {expired && (
                              <span className="font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
                                ⏰ Expiré
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="flex gap-2 mt-2">
                    <Input placeholder="Nouvel objectif 90 jours..." value={new90} onChange={(e) => setNew90(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addGoal("90day", new90, () => setNew90(""))} className="h-8 text-sm" />
                    <Button size="sm" variant="outline" className="h-8" onClick={() => addGoal("90day", new90, () => setNew90(""))}><Plus className="h-3.5 w-3.5" /></Button>
                  </div>
                </CardContent>
              </Card>

              {/* Monthly goals - 4 sections */}
              <Card className="glass-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" style={{ color: "hsl(var(--kpi-revenue))" }} />
                    Objectifs du mois ({format(now, "MMMM", { locale: fr })}) — {goalsMonthly.length}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {GOAL_SECTIONS.map((section) => {
                      const sectionGoals = goalsMonthly.filter((g: any) => (g.category || "islam") === section.key);
                      const inputKey = `monthly_${section.key}`;
                      return (
                        <div key={section.key} className="rounded-lg border p-3 space-y-2" style={{ borderColor: `${section.color}40` }}>
                          <p className="text-xs font-bold" style={{ color: section.color }}>{section.label}</p>
                          {sectionGoals.map((g: any) => (
                            <div key={g.id} className="flex items-center gap-1.5 group">
                              <Select value={g.status} onValueChange={(v) => updateGoalStatus(g.id, v)}>
                                <SelectTrigger className="w-20 h-6 text-[10px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="in_progress">En cours</SelectItem>
                                  <SelectItem value="achieved">Atteint</SelectItem>
                                </SelectContent>
                              </Select>
                              <span className={cn("flex-1 text-xs", g.status === "achieved" && "line-through text-muted-foreground")}>{g.title}</span>
                              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => deleteGoal(g.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                            </div>
                          ))}
                          <div className="flex gap-1.5">
                            <Input placeholder="+ objectif..." value={newMonthlyBySection[section.key] || ""} onChange={(e) => setNewMonthlyBySection((prev) => ({ ...prev, [section.key]: e.target.value }))}
                              onKeyDown={(e) => e.key === "Enter" && addGoal("monthly", newMonthlyBySection[section.key] || "", () => setNewMonthlyBySection((prev) => ({ ...prev, [section.key]: "" })), section.key)} className="h-7 text-xs" />
                            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => addGoal("monthly", newMonthlyBySection[section.key] || "", () => setNewMonthlyBySection((prev) => ({ ...prev, [section.key]: "" })), section.key)}><Plus className="h-3 w-3" /></Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Weekly goals - 4 sections */}
              <Card className="glass-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Star className="h-4 w-4" style={{ color: "hsl(var(--kpi-suppliers))" }} />
                    Objectifs de la semaine — {goalsWeekly.length}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Semaine du {format(currentWeekStart, "d", { locale: fr })} au {format(weekEnd, "d MMMM", { locale: fr })}
                  </p>
                </CardHeader>
                <CardContent className="space-y-0">
                  {/* 3 Priorités de la semaine */}
                  {(() => {
                    const priorities = goalsWeekly.filter((g: any) => (g.category || "") === "priority");
                    return (
                      <div className="rounded-lg border-2 border-amber-400/50 bg-amber-50/30 dark:bg-amber-950/10 p-3 mb-4 space-y-2">
                        <p className="text-xs font-bold text-amber-600 flex items-center gap-1.5">⭐ 3 Priorités de la semaine</p>
                        {priorities.map((g: any, idx: number) => (
                          <div key={g.id} className="flex items-center gap-2 group">
                            <span className="text-xs font-bold text-amber-500 w-5">{idx + 1}.</span>
                            <Checkbox checked={g.status === "achieved"} onCheckedChange={(checked) => updateGoalStatus(g.id, checked ? "achieved" : "in_progress")} className="h-4 w-4" />
                            <span className={cn("flex-1 text-sm font-medium", g.status === "achieved" && "line-through text-muted-foreground")}>{g.title}</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => deleteGoal(g.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                          </div>
                        ))}
                        {priorities.length < 3 && (
                          <div className="flex gap-1.5">
                            <Input placeholder={`Priorité ${priorities.length + 1}...`} value={newPriority} onChange={(e) => setNewPriority(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && addGoal("weekly", newPriority, () => setNewPriority(""), "priority")} className="h-7 text-xs" />
                            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => addGoal("weekly", newPriority, () => setNewPriority(""), "priority")}><Plus className="h-3 w-3" /></Button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {GOAL_SECTIONS.map((section) => {
                      const sectionGoals = goalsWeekly.filter((g: any) => (g.category || "islam") === section.key);
                      const inputKey = `weekly_${section.key}`;
                      return (
                        <div key={section.key} className="rounded-lg border p-3 space-y-2" style={{ borderColor: `${section.color}40` }}>
                          <p className="text-xs font-bold" style={{ color: section.color }}>{section.label}</p>
                          {sectionGoals.map((g: any) => (
                            <div key={g.id} className="flex items-center gap-1.5 group">
                              <Select value={g.status} onValueChange={(v) => updateGoalStatus(g.id, v)}>
                                <SelectTrigger className="w-20 h-6 text-[10px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="in_progress">En cours</SelectItem>
                                  <SelectItem value="achieved">Atteint</SelectItem>
                                </SelectContent>
                              </Select>
                              <span className={cn("flex-1 text-xs", g.status === "achieved" && "line-through text-muted-foreground")}>{g.title}</span>
                              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => deleteGoal(g.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                            </div>
                          ))}
                          <div className="flex gap-1.5">
                            <Input placeholder="+ objectif..." value={newWeeklyBySection[section.key] || ""} onChange={(e) => setNewWeeklyBySection((prev) => ({ ...prev, [section.key]: e.target.value }))}
                              onKeyDown={(e) => e.key === "Enter" && addGoal("weekly", newWeeklyBySection[section.key] || "", () => setNewWeeklyBySection((prev) => ({ ...prev, [section.key]: "" })), section.key)} className="h-7 text-xs" />
                            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => addGoal("weekly", newWeeklyBySection[section.key] || "", () => setNewWeeklyBySection((prev) => ({ ...prev, [section.key]: "" })), section.key)}><Plus className="h-3 w-3" /></Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* === Programme Sport === */}
          <Button variant="outline" className="w-full justify-between" onClick={() => setShowSports(!showSports)}>
            <span className="flex items-center gap-2">
              <Dumbbell className="h-4 w-4" />
              Programme Sport de la semaine
            </span>
            {showSports ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>

          {showSports && (
            <Card className="glass-card">
              <CardContent className="pt-4 space-y-2">
                {DAY_NAMES.map((d, i) => {
                  const sp = weeklySports.find((s: any) => s.day_index === i);
                  const isCompleted = !!(sp?.completed);
                  const kcalEaten = sp?.kcal_eaten || 0;
                  const kcalBurned = sp?.kcal_burned || 0;
                  const netKcal = kcalEaten - BASAL_KCAL - kcalBurned;
                  const isDeficitGoal = netKcal <= -500;
                  const isSurplus = netKcal >= 300;
                  return (
                    <div key={i} className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                      isSameDay(weekDays[i], now) ? "border-primary/50 bg-primary/5" : "border-border/50",
                      isCompleted && "border-green-400/50"
                    )} style={isCompleted ? { backgroundColor: "hsl(150, 50%, 95%)" } : undefined}>
                      <div className="flex flex-col items-center gap-1 pt-2">
                        <button
                          onClick={() => toggleSportCompleted(i)}
                          className={cn(
                            "h-6 w-6 rounded border-2 flex items-center justify-center transition-colors",
                            isCompleted ? "border-green-500 bg-green-500 text-white" : "border-muted-foreground/30 hover:border-green-400"
                          )}
                        >
                          {isCompleted && <CheckSquare className="h-4 w-4" />}
                        </button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn(
                            "text-sm font-bold",
                            isSameDay(weekDays[i], now) ? "text-primary" : "text-foreground"
                          )}>{d}</span>
                          <span className="text-xs text-muted-foreground">{format(weekDays[i], "d MMM", { locale: fr })}</span>
                          {isCompleted && <span className="text-[10px] font-medium text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">✓ Fait</span>}
                        </div>
                        <Textarea
                          placeholder="Programme sport du jour..."
                          value={sp?.program || ""}
                          onChange={(e) => {
                            setWeeklySports((prev) => {
                              const idx = prev.findIndex((s: any) => s.day_index === i);
                              if (idx >= 0) {
                                const updated = [...prev];
                                updated[idx] = { ...updated[idx], program: e.target.value };
                                return updated;
                              }
                              return [...prev, { day_index: i, program: e.target.value, completed: false, kcal_eaten: 0, kcal_burned: 0 }];
                            });
                          }}
                          onBlur={(e) => saveSportsProgram(i, e.target.value)}
                          className="min-h-[50px] text-xs resize-none border-dashed bg-transparent p-1.5 focus-visible:ring-1"
                        />
                        {/* Kcal Tracking */}
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-[10px] text-muted-foreground">🍽 Mangé (kcal)</Label>
                            <Input
                              type="number"
                              placeholder="0"
                              value={kcalEaten || ""}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                setWeeklySports((prev) => {
                                  const idx = prev.findIndex((s: any) => s.day_index === i);
                                  if (idx >= 0) {
                                    const updated = [...prev];
                                    updated[idx] = { ...updated[idx], kcal_eaten: val };
                                    return updated;
                                  }
                                  return [...prev, { day_index: i, program: "", completed: false, kcal_eaten: val, kcal_burned: 0 }];
                                });
                              }}
                              onBlur={(e) => saveSportsKcal(i, "kcal_eaten", parseInt(e.target.value) || 0)}
                              className="h-7 text-xs mt-0.5"
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] text-muted-foreground">🔥 Brûlé sport (kcal)</Label>
                            <Input
                              type="number"
                              placeholder="0"
                              value={kcalBurned || ""}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                setWeeklySports((prev) => {
                                  const idx = prev.findIndex((s: any) => s.day_index === i);
                                  if (idx >= 0) {
                                    const updated = [...prev];
                                    updated[idx] = { ...updated[idx], kcal_burned: val };
                                    return updated;
                                  }
                                  return [...prev, { day_index: i, program: "", completed: false, kcal_eaten: 0, kcal_burned: val }];
                                });
                              }}
                              onBlur={(e) => saveSportsKcal(i, "kcal_burned", parseInt(e.target.value) || 0)}
                              className="h-7 text-xs mt-0.5"
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] text-muted-foreground">📊 Net (base 2000)</Label>
                            <div className={cn(
                              "h-7 mt-0.5 flex items-center justify-center rounded-md text-xs font-bold border",
                              kcalEaten === 0 && kcalBurned === 0
                                ? "text-muted-foreground border-border/50"
                                : isDeficitGoal
                                  ? "text-green-700 bg-green-100 border-green-300"
                                  : isSurplus
                                    ? "text-red-700 bg-red-100 border-red-300"
                                    : "text-amber-700 bg-amber-50 border-amber-300"
                            )}>
                              {kcalEaten === 0 && kcalBurned === 0 ? "—" : `${netKcal > 0 ? "+" : ""}${netKcal}`}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* === Dashboard Discipline === */}
          <Button variant="outline" className="w-full justify-between" onClick={() => setShowDiscipline(!showDiscipline)}>
            <span className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Dashboard Discipline (Habitudes)
            </span>
            {showDiscipline ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>

          {showDiscipline && (
            <Card className="glass-card">
              <CardContent className="pt-4 space-y-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs whitespace-nowrap">Du</Label>
                    <Input type="date" value={disciplineFrom} onChange={(e) => setDisciplineFrom(e.target.value)} className="h-8 text-xs w-auto" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs whitespace-nowrap">Au</Label>
                    <Input type="date" value={disciplineTo} onChange={(e) => setDisciplineTo(e.target.value)} className="h-8 text-xs w-auto" />
                  </div>
                </div>

                {dailyHabits.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune habitude configurée.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr>
                          <th className="border border-border/50 px-2 py-2 text-xs font-semibold text-left sticky left-0 bg-background z-10">Habitude</th>
                          {disciplineDays.map((d) => (
                            <th key={format(d, "yyyy-MM-dd")} className={cn(
                              "border border-border/50 px-1 py-2 text-[10px] font-semibold text-center min-w-[40px]",
                              isSameDay(d, now) && "bg-primary/10 text-primary"
                            )}>
                              <div>{format(d, "EEE", { locale: fr })}</div>
                              <div>{format(d, "d")}</div>
                            </th>
                          ))}
                          <th className="border border-border/50 px-2 py-2 text-xs font-semibold text-center">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dailyHabits.map((h: any) => {
                          const completedCount = disciplineDays.filter((d) => isHabitCompleted(h.id, format(d, "yyyy-MM-dd"))).length;
                          const pct = disciplineDays.length > 0 ? Math.round((completedCount / disciplineDays.length) * 100) : 0;
                          return (
                            <tr key={h.id}>
                              <td className="border border-border/50 px-2 py-1.5 text-xs font-medium sticky left-0 bg-background z-10 whitespace-nowrap">{h.title}</td>
                              {disciplineDays.map((d) => {
                                const dateStr = format(d, "yyyy-MM-dd");
                                const done = isHabitCompleted(h.id, dateStr);
                                return (
                                  <td key={dateStr} className="border border-border/50 text-center p-0">
                                    <button
                                      onClick={() => toggleHabitLog(h.id, dateStr)}
                                      className={cn(
                                        "w-full h-8 text-sm transition-colors",
                                        done ? "bg-green-500/20 text-green-600" : "hover:bg-muted/50"
                                      )}
                                    >
                                      {done ? "✓" : ""}
                                    </button>
                                  </td>
                                );
                              })}
                              <td className={cn(
                                "border border-border/50 px-2 py-1.5 text-xs font-bold text-center",
                                pct >= 80 ? "text-green-600" : pct >= 50 ? "text-yellow-600" : "text-red-500"
                              )}>
                                {pct}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Daily tasks */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base font-semibold">Tâches quotidiennes</CardTitle>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setHabitsSheetOpen(true)}>
                <Star className="h-3.5 w-3.5 mr-1" /> Habitudes
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setSalatSheetOpen(true)}>
                <Settings2 className="h-3.5 w-3.5 mr-1" /> Horaires Salat
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                {format(currentWeekStart, "d MMM", { locale: fr })} — {format(weekEnd, "d MMM yyyy", { locale: fr })}
              </span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Mobile expanded day navigation */}
          {isMobile && expandedDay && (
            <div className="flex items-center justify-between mb-3">
              <Button variant="outline" size="sm" disabled={expandedDayIndex <= 0} onClick={() => navigateExpandedDay(-1)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Précédent
              </Button>
              <Button variant="outline" size="sm" disabled={expandedDayIndex >= 6} onClick={() => navigateExpandedDay(1)}>
                Suivant <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}

          <div className={cn(
            "grid gap-3",
            isMobile ? "grid-cols-1" : expandedDay ? "grid-cols-1" : "grid-cols-7"
          )}>
            {(isMobile
              ? (expandedDay ? weekDays.filter(d => format(d, "yyyy-MM-dd") === expandedDay) : visibleDays)
              : (expandedDay ? weekDays.filter(d => format(d, "yyyy-MM-dd") === expandedDay) : weekDays)
            ).map((day) =>
              isMobile ? renderMobileDayCard(day) : renderDesktopDayCard(day)
            )}
          </div>

          {isMobile && !expandedDay && (
            <Button
              variant="outline"
              className="w-full mt-3"
              onClick={() => setShowAllDays(!showAllDays)}
            >
              {showAllDays ? (
                <><ChevronUp className="h-4 w-4 mr-2" /> Voir seulement aujourd'hui</>
              ) : (
                <><ChevronDown className="h-4 w-4 mr-2" /> Voir tous les jours de la semaine</>
              )}
            </Button>
          )}

          {expandedDay && (
            <Button variant="outline" className="w-full mt-3" onClick={() => setExpandedDay(null)}>
              <Minimize2 className="h-4 w-4 mr-2" /> Retour à la vue semaine
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Salat times sheet */}
      <Sheet open={salatSheetOpen} onOpenChange={setSalatSheetOpen}>
        <SheetContent className="overflow-auto">
          <SheetHeader>
            <SheetTitle>Horaires de Salat — {format(now, "MMMM yyyy", { locale: fr })}</SheetTitle>
          </SheetHeader>
          <p className="text-sm text-muted-foreground mt-2 mb-4">
            Saisissez les horaires de prière pour ce mois. Les blocs de tâches seront calculés automatiquement.
          </p>
          <div className="space-y-4">
            {(["fajr", "dhuhr", "asr", "maghrib", "isha"] as const).map((prayer) => (
              <div key={prayer} className="space-y-1">
                <Label className="capitalize font-semibold">{prayer === "fajr" ? "Fajr (الفجر)" : prayer === "dhuhr" ? "Dhuhr (الظهر)" : prayer === "asr" ? "Asr (العصر)" : prayer === "maghrib" ? "Maghrib (المغرب)" : "Isha (العشاء)"}</Label>
                <Input
                  type="time"
                  value={salatForm[prayer]}
                  onChange={(e) => setSalatForm((prev) => ({ ...prev, [prayer]: e.target.value }))}
                  className="h-10"
                />
              </div>
            ))}
            <div className="pt-3 border-t space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Blocs calculés :</p>
              {BLOCKS.map((b) => (
                <div key={b.key} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: b.color }} />
                    <span>{b.label}</span>
                  </div>
                  <span className="font-semibold tabular-nums">
                    {calcDuration(salatForm[b.from as keyof typeof salatForm], salatForm[b.to as keyof typeof salatForm])}
                  </span>
                </div>
              ))}
            </div>
            <Button className="w-full" onClick={saveSalatTimes}>Sauvegarder</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Habits management sheet */}
      <Sheet open={habitsSheetOpen} onOpenChange={setHabitsSheetOpen}>
        <SheetContent className="overflow-auto">
          <SheetHeader>
            <SheetTitle>Habitudes journalières non négociables</SheetTitle>
          </SheetHeader>
          <p className="text-sm text-muted-foreground mt-2 mb-4">
            Ces habitudes apparaissent automatiquement chaque jour.
          </p>
          <div className="space-y-3">
            {dailyHabits.map((h: any) => (
              <div key={h.id} className="flex items-center gap-2 group">
                {editingHabitId === h.id ? (
                  <Input
                    autoFocus
                    value={editingHabitTitle}
                    onChange={(e) => setEditingHabitTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") updateDailyHabit(h.id, editingHabitTitle);
                      if (e.key === "Escape") setEditingHabitId(null);
                    }}
                    onBlur={() => updateDailyHabit(h.id, editingHabitTitle)}
                    className="h-9 text-sm"
                  />
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium">{h.title}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingHabitId(h.id); setEditingHabitTitle(h.title); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteDailyHabit(h.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </>
                )}
              </div>
            ))}
            <div className="flex gap-2 pt-2 border-t">
              <Input
                placeholder="Nouvelle habitude..."
                value={newHabit}
                onChange={(e) => setNewHabit(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addDailyHabit()}
                className="h-9 text-sm"
              />
              <Button size="sm" className="h-9" onClick={addDailyHabit}><Plus className="h-4 w-4" /></Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
