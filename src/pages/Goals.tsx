import { useEffect, useState, DragEvent } from "react";
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
import { Plus, Trash2, ChevronLeft, ChevronRight, Target, Calendar, Star, Pencil, ChevronDown, ChevronUp, Eye, EyeOff, Clock, Settings2, Dumbbell, BarChart3, Maximize2, Minimize2, CheckSquare, ListTodo, Trophy, Sparkles, CalendarDays, Check } from "lucide-react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay, subDays, addDays, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EditableText } from "@/components/EditableText";

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

// Parse numbered tasks like "1- Comptabilité" or "2. Marketing"
function parseNumberedTask(title: string): { number: string | null; text: string } {
  const match = title.match(/^(\d+)\s*[-.)]\s*(.*)$/);
  if (match) return { number: match[1], text: match[2] };
  return { number: null, text: title };
}

function TaskTitle({ title, completed, onRename }: { title: string; completed: boolean; onRename?: (v: string) => void }) {
  const { number, text } = parseNumberedTask(title);
  if (number) {
    return (
      <EditableText value={title} onSave={(v) => onRename?.(v)} className={cn("flex-1 leading-snug", completed && "text-emerald-700/70 dark:text-emerald-400/70")}>
        <span className="font-black text-lg mr-1.5" style={{ color: completed ? undefined : "hsl(220, 70%, 50%)" }}>{number}-</span>
        <span className="font-bold text-base">{text}</span>
      </EditableText>
    );
  }
  return (
    <EditableText value={title} onSave={(v) => onRename?.(v)} className={cn("text-sm flex-1 leading-snug", completed && "text-emerald-700/70 dark:text-emerald-400/70")} />
  );
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
  const [showNonNego, setShowNonNego] = useState(true);

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
  const [blockOverrides, setBlockOverrides] = useState<Record<string, { start_time: string; end_time: string }>>({});
  const [editingBlock, setEditingBlock] = useState<string | null>(null);
  const [editingBlockTimes, setEditingBlockTimes] = useState<{ start: string; end: string }>({ start: "", end: "" });
  const [weeklySports, setWeeklySports] = useState<any[]>([]);
  const [habitLogs, setHabitLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Drag state
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const [dragOverBlock, setDragOverBlock] = useState<string | null>(null);

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
  const [newHabitDays, setNewHabitDays] = useState<number[]>([]);
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

    const [g90, gy, gm, gw, dt, dh, stRes, spRes, hlRes, boRes] = await Promise.all([
      (supabase.from("goals" as any) as any).select("*").eq("type", "90day").order("created_at"),
      (supabase.from("goals" as any) as any).select("*").eq("type", "yearly").eq("year", currentYear).order("created_at"),
      (supabase.from("goals" as any) as any).select("*").eq("type", "monthly").eq("month", currentMonth).eq("year", currentYear).order("created_at"),
      (supabase.from("goals" as any) as any).select("*").eq("type", "weekly").eq("week_start", format(currentWeekStart, "yyyy-MM-dd")).order("created_at"),
      (supabase.from("daily_tasks" as any) as any).select("*").gte("day_date", wsStr).lte("day_date", weStr).order("created_at"),
      (supabase.from("daily_habits" as any) as any).select("*").eq("active", true).order("sort_order"),
      (supabase.from("salat_times" as any) as any).select("*").eq("month", currentMonth).eq("year", currentYear).maybeSingle(),
      (supabase.from("weekly_sports" as any) as any).select("*").eq("week_start", wsStr),
      (supabase.from("daily_habit_logs" as any) as any).select("*").gte("day_date", disciplineFrom).lte("day_date", disciplineTo),
      (supabase.from("daily_block_overrides" as any) as any).select("*").gte("day_date", wsStr).lte("day_date", weStr),
    ]);
    setGoals90(g90.data || []);
    setGoalsYearly(gy.data || []);
    setGoalsMonthly(gm.data || []);
    setGoalsWeekly(gw.data || []);
    setDailyTasks(dt.data || []);
    setDailyHabits(dh.data || []);
    setWeeklySports(spRes.data || []);
    setHabitLogs(hlRes.data || []);
    const ovMap: Record<string, { start_time: string; end_time: string }> = {};
    (boRes.data || []).forEach((o: any) => {
      ovMap[`${o.day_date}_${o.block_key}`] = {
        start_time: (o.start_time || "").toString().slice(0, 5),
        end_time: (o.end_time || "").toString().slice(0, 5),
      };
    });
    setBlockOverrides(ovMap);
    if (stRes.data) {
      setSalatTimes(stRes.data);
      setSalatForm({ fajr: stRes.data.fajr?.slice(0, 5) || DEFAULT_SALAT.fajr, dhuhr: stRes.data.dhuhr?.slice(0, 5) || DEFAULT_SALAT.dhuhr, asr: stRes.data.asr?.slice(0, 5) || DEFAULT_SALAT.asr, maghrib: stRes.data.maghrib?.slice(0, 5) || DEFAULT_SALAT.maghrib, isha: stRes.data.isha?.slice(0, 5) || DEFAULT_SALAT.isha });
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [user, currentWeekStart, disciplineFrom, disciplineTo]);

  // Get times for a specific block on a specific day (override > salat default)
  const getBlockTimes = (dateStr: string, block: typeof BLOCKS[number]) => {
    const ov = blockOverrides[`${dateStr}_${block.key}`];
    if (ov) return { from: ov.start_time, to: ov.end_time, custom: true };
    const from = (st[block.from as keyof typeof st] || "").toString().slice(0, 5);
    const to = (st[block.to as keyof typeof st] || "").toString().slice(0, 5);
    return { from, to, custom: false };
  };

  const startEditBlockTimes = (dateStr: string, block: typeof BLOCKS[number]) => {
    const t = getBlockTimes(dateStr, block);
    setEditingBlock(`${dateStr}_${block.key}`);
    setEditingBlockTimes({ start: t.from, end: t.to });
  };

  const saveBlockOverride = async (dateStr: string, blockKey: string) => {
    if (!user) return;
    const { start, end } = editingBlockTimes;
    if (!start || !end) { setEditingBlock(null); return; }
    const key = `${dateStr}_${blockKey}`;
    setBlockOverrides((prev) => ({ ...prev, [key]: { start_time: start, end_time: end } }));
    setEditingBlock(null);
    const { error } = await (supabase.from("daily_block_overrides" as any) as any)
      .upsert({ user_id: user.id, day_date: dateStr, block_key: blockKey, start_time: start, end_time: end }, { onConflict: "user_id,day_date,block_key" });
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); fetchAll(); }
  };

  const resetBlockOverride = async (dateStr: string, blockKey: string) => {
    if (!user) return;
    const key = `${dateStr}_${blockKey}`;
    setBlockOverrides((prev) => { const n = { ...prev }; delete n[key]; return n; });
    setEditingBlock(null);
    await (supabase.from("daily_block_overrides" as any) as any).delete().eq("user_id", user.id).eq("day_date", dateStr).eq("block_key", blockKey);
  };


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

  // Duplicate weekly goals to next week
  const duplicateWeeklyToNext = async () => {
    if (!user || goalsWeekly.length === 0) {
      toast({ title: "Rien à dupliquer", description: "Aucun objectif cette semaine." });
      return;
    }
    const nextWeekStart = format(addWeeks(currentWeekStart, 1), "yyyy-MM-dd");
    const rows = goalsWeekly.map((g: any) => ({
      user_id: user.id, type: "weekly", title: g.title, status: "todo", progress: 0,
      week_start: nextWeekStart, category: g.category || "islam",
    }));
    const { error } = await (supabase.from("goals" as any) as any).insert(rows);
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Objectifs dupliqués", description: `${rows.length} objectif(s) copiés vers la semaine prochaine.` });
  };

  // Duplicate monthly goals to next month
  const duplicateMonthlyToNext = async () => {
    if (!user || goalsMonthly.length === 0) {
      toast({ title: "Rien à dupliquer", description: "Aucun objectif ce mois." });
      return;
    }
    let nextMonth = currentMonth + 1;
    let nextYear = currentYear;
    if (nextMonth > 12) { nextMonth = 1; nextYear += 1; }
    const rows = goalsMonthly.map((g: any) => ({
      user_id: user.id, type: "monthly", title: g.title, status: "todo", progress: 0,
      month: nextMonth, year: nextYear, category: g.category || "islam",
    }));
    const { error } = await (supabase.from("goals" as any) as any).insert(rows);
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Objectifs dupliqués", description: `${rows.length} objectif(s) copiés vers le mois prochain.` });
  };

  // Copy daily tasks from previous week into current week (same weekday offset)
  const copyTasksFromLastWeek = async () => {
    if (!user) return;
    const prevWeekStart = subWeeks(currentWeekStart, 1);
    const prevWeekEnd = endOfWeek(prevWeekStart, { weekStartsOn: 1 });
    const { data } = await (supabase.from("daily_tasks" as any) as any)
      .select("*")
      .gte("day_date", format(prevWeekStart, "yyyy-MM-dd"))
      .lte("day_date", format(prevWeekEnd, "yyyy-MM-dd"));
    if (!data || data.length === 0) {
      toast({ title: "Rien à copier", description: "Aucune tâche la semaine précédente." });
      return;
    }
    const rows = data.map((t: any) => {
      const oldDate = parseISO(t.day_date);
      const newDate = addDays(oldDate, 7);
      return {
        user_id: user.id, title: t.title, day_date: format(newDate, "yyyy-MM-dd"),
        block: t.block || "fajr_dhuhr", completed: false, scheduled_time: t.scheduled_time || null,
      };
    });
    const { error } = await (supabase.from("daily_tasks" as any) as any).insert(rows);
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Tâches copiées 📋", description: `${rows.length} tâche(s) copiée(s) depuis la semaine précédente.` });
    fetchAll();
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

  const renameDailyTask = async (id: string, newTitle: string) => {
    setDailyTasks((prev) => prev.map((t) => t.id === id ? { ...t, title: newTitle } : t));
    await (supabase.from("daily_tasks" as any) as any).update({ title: newTitle }).eq("id", id);
  };

  const setTaskPriority = async (id: string, priority: string) => {
    setDailyTasks((prev) => prev.map((t) => t.id === id ? { ...t, priority } : t));
    await (supabase.from("daily_tasks" as any) as any).update({ priority }).eq("id", id);
  };

  const renameGoal = async (id: string, newTitle: string) => {
    const updateList = (list: any[]) => list.map((g) => g.id === id ? { ...g, title: newTitle } : g);
    setGoals90((prev) => updateList(prev));
    setGoalsYearly((prev) => updateList(prev));
    setGoalsMonthly((prev) => updateList(prev));
    setGoalsWeekly((prev) => updateList(prev));
    await (supabase.from("goals" as any) as any).update({ title: newTitle }).eq("id", id);
  };

  const moveTaskToBlock = async (id: string, newBlock: string) => {
    setDailyTasks((prev) => prev.map((t) => t.id === id ? { ...t, block: newBlock } : t));
    await (supabase.from("daily_tasks" as any) as any).update({ block: newBlock } as any).eq("id", id);
  };

  const saveTaskTime = async (id: string, time: string) => {
    const val = time || null;
    setDailyTasks((prev) => prev.map((t) => t.id === id ? { ...t, scheduled_time: val } : t));
    await (supabase.from("daily_tasks" as any) as any).update({ scheduled_time: val } as any).eq("id", id);
  };

  // Block-level drag handlers
  const handleBlockDragOver = (e: DragEvent, blockKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setDragOverBlock(blockKey);
  };

  const handleBlockDragLeave = (e: DragEvent) => {
    e.stopPropagation();
    setDragOverBlock(null);
  };

  const handleBlockDrop = (e: DragEvent, blockKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    const taskId = e.dataTransfer.getData("text/plain") || dragTaskId;
    if (taskId) {
      moveTaskToBlock(taskId, blockKey);
    }
    setDragTaskId(null);
    setDragOverBlock(null);
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

  // Returns true if a habit should be visible on a given date
  const habitVisibleOnDate = (h: any, dateStr: string) => {
    const days = h.days_of_week as number[] | null | undefined;
    if (!days || days.length === 0) return true; // every day
    const dow = new Date(dateStr + "T00:00:00").getDay(); // 0=Sun..6=Sat
    return days.includes(dow);
  };

  const addDailyHabit = async (category?: string) => {
    if (!user || !newHabit.trim()) return;
    const cat = category || newHabitCategory;
    const days = cat === "recurring" && newHabitDays.length > 0 ? newHabitDays : null;
    const tempId = crypto.randomUUID();
    const temp = { id: tempId, user_id: user.id, title: newHabit.trim(), sort_order: dailyHabits.length, active: true, category: cat, days_of_week: days };
    setDailyHabits((prev) => [...prev, temp]);
    setNewHabit("");
    const { data, error } = await (supabase.from("daily_habits" as any) as any).insert({
      user_id: user.id, title: newHabit.trim(), sort_order: dailyHabits.length, category: cat, days_of_week: days,
    }).select().single();
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); fetchAll(); }
    else if (data) setDailyHabits((prev) => prev.map((h) => h.id === tempId ? data : h));
  };

  // Add/update day priority (stored as daily_task with block "day_priority")
  const addDayPriority = async (dayDate: string) => {
    if (!user) return;
    const text = newDayPriority[dayDate];
    if (!text?.trim()) return;
    const tempId = crypto.randomUUID();
    const tempTask = { id: tempId, user_id: user.id, title: text.trim(), day_date: dayDate, block: "day_priority", completed: false };
    setDailyTasks((prev) => [...prev, tempTask]);
    setNewDayPriority((prev) => ({ ...prev, [dayDate]: "" }));
    const { data, error } = await (supabase.from("daily_tasks" as any) as any).insert({ user_id: user.id, title: text.trim(), day_date: dayDate, block: "day_priority" }).select().single();
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); fetchAll(); }
    else if (data) setDailyTasks((prev) => prev.map((t) => t.id === tempId ? data : t));
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
          {/* 2 Priorités du jour */}
          {(() => {
            const priorities = dayTasks.filter((t: any) => t.block === "day_priority");
            return (
              <div className="px-4 py-2.5 border-b" style={{ backgroundColor: "hsl(45, 90%, 95%)" }}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "hsl(45, 80%, 35%)" }}>⭐ 2 Priorités du jour</p>
                {priorities.map((t: any) => (
                  <div key={t.id} className="flex items-center gap-2 py-0.5 group">
                    <Checkbox checked={t.completed} onCheckedChange={() => toggleDailyTask(t.id, t.completed)} className="h-4 w-4" />
                    <EditableText value={t.title} onSave={(v) => renameDailyTask(t.id, v)} className={cn("text-sm font-semibold flex-1", t.completed && "line-through text-muted-foreground")} />
                    <button onClick={() => deleteDailyTask(t.id)} className="opacity-0 group-hover:opacity-100 text-destructive shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
                {priorities.length < 2 && (
                  <Input
                    placeholder={priorities.length === 0 ? "Priorité #1" : "Priorité #2"}
                    value={newDayPriority[dateStr] || ""}
                    onChange={(e) => setNewDayPriority((prev) => ({ ...prev, [dateStr]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && addDayPriority(dateStr)}
                    className="h-7 text-xs border-dashed bg-transparent mt-1"
                  />
                )}
              </div>
            );
          })()}

          {/* Récurrentes par jour - violet */}
          {showNonNego && dailyHabits.filter((h: any) => h.category === "recurring" && habitVisibleOnDate(h, dateStr)).length > 0 && (
            <div className="px-4 py-3 border-b border-dashed" style={{ backgroundColor: "hsl(270, 60%, 95%)" }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "hsl(270, 60%, 40%)" }}>
                📅 RÉCURRENTES
              </p>
              {dailyHabits.filter((h: any) => h.category === "recurring" && habitVisibleOnDate(h, dateStr)).map((h: any) => (
                <div key={h.id} className="flex items-center gap-2 py-0.5">
                  <Checkbox checked={isHabitCompleted(h.id, dateStr)} onCheckedChange={() => toggleHabitLog(h.id, dateStr)} className="h-4 w-4" />
                  <span className={cn("text-sm font-medium", isHabitCompleted(h.id, dateStr) && "line-through text-muted-foreground")}>{h.title}</span>
                </div>
              ))}
            </div>
          )}


          {BLOCKS.map((block) => {
            const blockTasks = dayTasks.filter((t: any) => (t.block || "fajr_dhuhr") === block.key);
            const bt = getBlockTimes(dateStr, block);
            const fromTime = bt.from;
            const toTime = bt.to;
            const duration = fromTime && toTime ? calcDuration(fromTime, toTime) : "";
            const inputKey = `${dateStr}_${block.key}`;
            const editKey = `${dateStr}_${block.key}`;
            const isEditing = editingBlock === editKey;

            return (
              <div key={block.key} className={cn(
                "border-b last:border-b-0 transition-colors",
                dragOverBlock === block.key && "ring-2 ring-primary ring-inset"
              )}
                onDragOver={(e) => handleBlockDragOver(e as any, block.key)}
                onDragLeave={(e) => handleBlockDragLeave(e as any)}
                onDrop={(e) => handleBlockDrop(e as any, block.key)}
              >
                <div className="px-4 py-2 flex items-center justify-between gap-2 flex-wrap" style={{ backgroundColor: `${block.color}15` }}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: block.color }} />
                    <span className="text-xs font-semibold" style={{ color: block.color }}>{block.label}</span>
                    {bt.custom && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">PERSO</span>}
                  </div>
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <input type="time" value={editingBlockTimes.start} onChange={(e) => setEditingBlockTimes((p) => ({ ...p, start: e.target.value }))} className="h-6 text-[10px] px-1 rounded border border-input bg-background tabular-nums" />
                      <span className="text-[10px]">→</span>
                      <input type="time" value={editingBlockTimes.end} onChange={(e) => setEditingBlockTimes((p) => ({ ...p, end: e.target.value }))} className="h-6 text-[10px] px-1 rounded border border-input bg-background tabular-nums" />
                      <button onClick={() => saveBlockOverride(dateStr, block.key)} className="h-6 px-1.5 text-[10px] font-bold rounded bg-primary text-primary-foreground">OK</button>
                      {bt.custom && <button onClick={() => resetBlockOverride(dateStr, block.key)} title="Réinitialiser" className="h-6 px-1.5 text-[10px] rounded bg-muted hover:bg-destructive hover:text-destructive-foreground">↺</button>}
                      <button onClick={() => setEditingBlock(null)} className="h-6 px-1 text-[10px] rounded hover:bg-muted">✕</button>
                    </div>
                  ) : (
                    <button onClick={() => startEditBlockTimes(dateStr, block)} className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-background/60 px-1.5 py-0.5 rounded transition-colors" title="Personnaliser horaires de ce bloc">
                      <Clock className="h-3 w-3" />
                      <span className="tabular-nums">{fromTime} — {toTime}</span>
                      {duration && <span className="font-semibold ml-1">({duration})</span>}
                      <Pencil className="h-2.5 w-2.5 opacity-50" />
                    </button>
                  )}
                </div>

                <div className="px-4 py-2 space-y-1.5 min-h-[40px]">
                  {blockTasks.map((t: any) => (
                    <div key={t.id} className="flex items-start gap-2 group cursor-grab active:cursor-grabbing"
                      draggable onDragStart={(e) => handleDragStart(e as any, t.id)}>
                      <Checkbox checked={t.completed} onCheckedChange={() => toggleDailyTask(t.id, t.completed)} className="mt-0.5 h-4 w-4" />
                     <TaskTitle title={t.title} completed={t.completed} onRename={(v) => renameDailyTask(t.id, v)} />
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
      const totalDay = dayTasks.length;
      const doneDay = dayTasks.filter((t: any) => t.completed).length;
      const pctDay = totalDay > 0 ? Math.round((doneDay / totalDay) * 100) : 0;
      const recurringForDay = dailyHabits.filter((h: any) => h.category === "recurring" && habitVisibleOnDate(h, dateStr));
      const recurringDone = recurringForDay.filter((h: any) => isHabitCompleted(h.id, dateStr)).length;

      return (
        <Card key={dateStr} className="overflow-hidden border-2 border-primary/40 shadow-2xl col-span-7 animate-fade-in">
          {/* === Hero header === */}
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-secondary opacity-95" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.25),_transparent_60%)]" />
            <div className="relative px-6 py-5 text-primary-foreground">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4 min-w-0">
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-primary-foreground hover:bg-white/20 shrink-0"
                    disabled={expandedDayIndex <= 0} onClick={() => navigateExpandedDay(-1)}>
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-baseline gap-3 flex-wrap">
                      <span className="text-3xl font-bold tracking-tight">{DAY_NAMES[dayIndex]}</span>
                      <span className="text-2xl font-light tabular-nums opacity-90">
                        {format(day, "d MMMM yyyy", { locale: fr })}
                      </span>
                      {isToday && (
                        <span className="text-[10px] font-bold uppercase tracking-widest bg-white text-primary px-2 py-0.5 rounded-full shadow-sm">
                          Aujourd'hui
                        </span>
                      )}
                    </div>
                    <p className="text-xs opacity-80 mt-0.5 font-medium">
                      Vue détaillée — Time-blocking & priorités
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-primary-foreground hover:bg-white/20 shrink-0"
                    disabled={expandedDayIndex >= 6} onClick={() => navigateExpandedDay(1)}>
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="h-9 text-primary-foreground hover:bg-white/20 border border-white/30"
                    onClick={() => setSalatSheetOpen(true)}>
                    <Settings2 className="h-3.5 w-3.5 mr-1.5" /> Horaires Salat
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-primary-foreground hover:bg-white/20"
                    onClick={() => setExpandedDay(null)} title="Réduire">
                    <Minimize2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* === Stats bar === */}
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white/15 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/20">
                  <p className="text-[10px] uppercase tracking-wider opacity-80 font-semibold">Tâches</p>
                  <p className="text-lg font-bold tabular-nums">{doneDay}<span className="opacity-60 text-sm">/{totalDay}</span></p>
                </div>
                <div className="bg-white/15 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/20">
                  <p className="text-[10px] uppercase tracking-wider opacity-80 font-semibold">Progression</p>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-bold tabular-nums">{pctDay}%</p>
                    <div className="flex-1 h-1.5 bg-white/25 rounded-full overflow-hidden">
                      <div className="h-full bg-white transition-all" style={{ width: `${pctDay}%` }} />
                    </div>
                  </div>
                </div>
                <div className="bg-white/15 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/20">
                  <p className="text-[10px] uppercase tracking-wider opacity-80 font-semibold">Récurrentes</p>
                  <p className="text-lg font-bold tabular-nums">{recurringDone}<span className="opacity-60 text-sm">/{recurringForDay.length}</span></p>
                </div>
                <div className="bg-white/15 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/20">
                  <p className="text-[10px] uppercase tracking-wider opacity-80 font-semibold">Priorités</p>
                  <p className="text-lg font-bold tabular-nums">
                    {dayTasks.filter((t: any) => t.block === "day_priority" && t.completed).length}
                    <span className="opacity-60 text-sm">/{dayTasks.filter((t: any) => t.block === "day_priority").length}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <CardContent className="p-6 space-y-5 bg-gradient-to-b from-muted/30 to-transparent">
            {/* === 2 Priorités du jour === */}
            {(() => {
              const priorities = dayTasks.filter((t: any) => t.block === "day_priority");
              return (
                <div className="rounded-xl border-2 border-amber-300/60 dark:border-amber-700/40 bg-gradient-to-br from-amber-50 to-amber-100/40 dark:from-amber-950/30 dark:to-amber-900/10 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-7 w-7 rounded-lg bg-amber-400 dark:bg-amber-600 flex items-center justify-center shadow-sm">
                      <Star className="h-4 w-4 text-white fill-white" />
                    </div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
                      2 Priorités du jour
                    </h3>
                  </div>
                  <div className="space-y-1.5">
                    {priorities.map((t: any) => (
                      <div key={t.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/70 dark:bg-black/20 hover:bg-white dark:hover:bg-black/40 transition-colors group">
                        <Checkbox checked={t.completed} onCheckedChange={() => toggleDailyTask(t.id, t.completed)} className="h-5 w-5" />
                        <EditableText value={t.title} onSave={(v) => renameDailyTask(t.id, v)}
                          className={cn("text-sm font-semibold flex-1 text-amber-950 dark:text-amber-100", t.completed && "line-through opacity-50")} />
                        <button onClick={() => deleteDailyTask(t.id)} className="opacity-0 group-hover:opacity-100 text-destructive shrink-0 transition-opacity">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    {priorities.length < 2 && (
                      <Input placeholder={priorities.length === 0 ? "✨ Priorité #1" : "✨ Priorité #2"} value={newDayPriority[dateStr] || ""}
                        onChange={(e) => setNewDayPriority((prev) => ({ ...prev, [dateStr]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && addDayPriority(dateStr)}
                        className="h-9 text-sm border-dashed border-amber-400/50 bg-white/40 dark:bg-black/10 placeholder:text-amber-700/60 dark:placeholder:text-amber-300/40" />
                    )}
                  </div>
                </div>
              );
            })()}

            {/* === Récurrentes === */}
            {showNonNego && recurringForDay.length > 0 && (
              <div className="rounded-xl border-2 border-purple-300/60 dark:border-purple-700/40 bg-gradient-to-br from-purple-50 to-purple-100/40 dark:from-purple-950/30 dark:to-purple-900/10 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-purple-500 dark:bg-purple-600 flex items-center justify-center shadow-sm">
                      <CalendarDays className="h-4 w-4 text-white" />
                    </div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-purple-900 dark:text-purple-200">
                      Récurrentes
                    </h3>
                  </div>
                  <span className="text-xs font-bold tabular-nums text-purple-700 dark:text-purple-300 bg-white/60 dark:bg-black/20 px-2 py-0.5 rounded-full">
                    {recurringDone}/{recurringForDay.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {recurringForDay.map((h: any) => {
                    const done = isHabitCompleted(h.id, dateStr);
                    return (
                      <label key={h.id} className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all",
                        done ? "bg-purple-200/50 dark:bg-purple-800/30" : "bg-white/70 dark:bg-black/20 hover:bg-white dark:hover:bg-black/40"
                      )}>
                        <Checkbox checked={done} onCheckedChange={() => toggleHabitLog(h.id, dateStr)} className="h-4 w-4" />
                        <span className={cn("text-sm font-medium text-purple-950 dark:text-purple-100", done && "line-through opacity-50")}>{h.title}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* === Time-blocks === */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              {BLOCKS.map((block) => {
                const blockTasks = dayTasks.filter((t: any) => (t.block || "fajr_dhuhr") === block.key);
                const blockDone = blockTasks.filter((t: any) => t.completed).length;
                const bt = getBlockTimes(dateStr, block);
                const fromTime = bt.from;
                const toTime = bt.to;
                const duration = fromTime && toTime ? calcDuration(fromTime, toTime) : "";
                const inputKey = `${dateStr}_${block.key}`;
                const isDragTarget = dragOverBlock === block.key;
                const editKey = `${dateStr}_${block.key}`;
                const isEditing = editingBlock === editKey;

                return (
                  <div key={block.key}
                    className={cn(
                      "rounded-xl border-2 bg-card overflow-hidden flex flex-col transition-all shadow-sm hover:shadow-md",
                      isDragTarget ? "ring-2 ring-primary ring-offset-2 scale-[1.02]" : "border-border/60"
                    )}
                    style={{ borderTopColor: block.color, borderTopWidth: "4px" }}
                    onDragOver={(e) => handleBlockDragOver(e as any, block.key)}
                    onDragLeave={(e) => handleBlockDragLeave(e as any)}
                    onDrop={(e) => handleBlockDrop(e as any, block.key)}
                  >
                    <div className="px-3 py-2.5" style={{ backgroundColor: `${block.color}12` }}>
                      <div className="flex items-center justify-between mb-1 gap-1">
                        <span className="text-xs font-bold uppercase tracking-wide truncate" style={{ color: block.color }}>
                          {block.label}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {bt.custom && <span className="text-[8px] font-bold px-1 py-0.5 rounded-full bg-primary/15 text-primary">PERSO</span>}
                          {blockTasks.length > 0 && (
                            <span className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full bg-white dark:bg-black/30" style={{ color: block.color }}>
                              {blockDone}/{blockTasks.length}
                            </span>
                          )}
                        </div>
                      </div>
                      {isEditing ? (
                        <div className="flex items-center gap-1 flex-wrap">
                          <input type="time" value={editingBlockTimes.start} onChange={(e) => setEditingBlockTimes((p) => ({ ...p, start: e.target.value }))} className="h-6 text-[10px] px-1 rounded border border-input bg-background tabular-nums w-[70px]" />
                          <span className="text-[10px]">→</span>
                          <input type="time" value={editingBlockTimes.end} onChange={(e) => setEditingBlockTimes((p) => ({ ...p, end: e.target.value }))} className="h-6 text-[10px] px-1 rounded border border-input bg-background tabular-nums w-[70px]" />
                          <button onClick={() => saveBlockOverride(dateStr, block.key)} className="h-6 px-1.5 text-[10px] font-bold rounded bg-primary text-primary-foreground">OK</button>
                          {bt.custom && <button onClick={() => resetBlockOverride(dateStr, block.key)} title="Réinitialiser à l'horaire par défaut" className="h-6 px-1.5 text-[10px] rounded bg-muted hover:bg-destructive hover:text-destructive-foreground">↺</button>}
                          <button onClick={() => setEditingBlock(null)} className="h-6 px-1 text-[10px] rounded hover:bg-muted">✕</button>
                        </div>
                      ) : (
                        <button onClick={() => startEditBlockTimes(dateStr, block)} className="w-full flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground hover:bg-background/40 px-1 py-0.5 rounded transition-colors font-medium" title="Personnaliser horaires de ce bloc">
                          <Clock className="h-3 w-3" />
                          <span className="tabular-nums">{fromTime} — {toTime}</span>
                          {duration && <span className="ml-auto font-bold" style={{ color: block.color }}>{duration}</span>}
                          <Pencil className="h-2.5 w-2.5 opacity-50" />
                        </button>
                      )}
                    </div>

                    <div className="px-3 py-3 space-y-1.5 flex-1 min-h-[120px]">
                      {blockTasks.map((t: any) => (
                        <div key={t.id}
                          className={cn(
                            "flex items-start gap-2 group cursor-grab active:cursor-grabbing px-2 py-1.5 rounded-md transition-colors",
                            t.completed ? "bg-muted/40" : "hover:bg-muted/60"
                          )}
                          draggable onDragStart={(e) => handleDragStart(e as any, t.id)}>
                          <Checkbox checked={t.completed} onCheckedChange={() => toggleDailyTask(t.id, t.completed)} className="mt-0.5 h-4 w-4" />
                          <TaskTitle title={t.title} completed={t.completed} onRename={(v) => renameDailyTask(t.id, v)} />
                          <button onClick={() => deleteDailyTask(t.id)} className="opacity-0 group-hover:opacity-100 text-destructive shrink-0 transition-opacity">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      <Input
                        placeholder="+ tâche"
                        value={newBlockTexts[inputKey] || ""}
                        onChange={(e) => setNewBlockTexts((prev) => ({ ...prev, [inputKey]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && addDailyTask(dateStr, block.key)}
                        className="h-8 text-xs border-dashed bg-transparent focus-visible:ring-1"
                        style={{ borderColor: `${block.color}40` }}
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

    const completedCount = dayTasks.filter((t: any) => t.completed).length;
    const totalCount = dayTasks.length;
    const priorities = dayTasks.filter((t: any) => t.block === "day_priority");
    const PRIO_RANK: Record<string, number> = { high: 1, normal: 2, low: 3 };
    const otherTasks = dayTasks
      .filter((t: any) => t.block !== "day_priority")
      .slice()
      .sort((a: any, b: any) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        const pa = PRIO_RANK[a.priority || "normal"] ?? 2;
        const pb = PRIO_RANK[b.priority || "normal"] ?? 2;
        if (pa !== pb) return pa - pb;
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      });
    const recurringHabits = dailyHabits.filter((h: any) => h.category === "recurring" && habitVisibleOnDate(h, dateStr));
    const recurringDone = recurringHabits.filter((h: any) => isHabitCompleted(h.id, dateStr)).length;
    const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    const isPast = day < new Date(format(now, "yyyy-MM-dd"));
    const isWeekend = dayIndex === 5 || dayIndex === 6;

    return (
      <Card
        key={dateStr}
        className={cn(
          "group/card overflow-hidden transition-all duration-300 flex flex-col",
          "border bg-card hover:shadow-lg hover:-translate-y-0.5",
          isToday
            ? "border-primary/50 shadow-md ring-1 ring-primary/30 bg-gradient-to-b from-primary/5 to-card"
            : isPast
              ? "border-border/40 opacity-90"
              : "border-border/60",
          isDragOver && "ring-2 ring-primary ring-offset-2 scale-[1.01]"
        )}
        onDragOver={(e) => handleDragOver(e as any, dateStr)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e as any, dateStr)}
      >
        {/* Header — clean, calm, focused */}
        <button
          type="button"
          onClick={() => setExpandedDay(dateStr)}
          className={cn(
            "relative px-3 pt-3 pb-2.5 flex flex-col gap-2 w-full text-left transition-colors",
            "border-b border-border/40 hover:bg-muted/30",
            isToday && "bg-primary/5"
          )}
          title="Vue détaillée du jour"
        >
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-2 min-w-0">
              <span className={cn(
                "text-[10px] font-semibold uppercase tracking-[0.12em]",
                isToday ? "text-primary" : isWeekend ? "text-secondary" : "text-muted-foreground"
              )}>
                {DAY_NAMES[dayIndex].slice(0, 3)}
              </span>
              <span className={cn(
                "text-2xl font-bold tabular-nums leading-none",
                isToday ? "text-primary" : "text-foreground"
              )}>
                {format(day, "d", { locale: fr })}
              </span>
            </div>
            {isToday ? (
              <span className="text-[9px] font-bold uppercase tracking-wider bg-primary text-primary-foreground px-2 py-0.5 rounded-full shadow-sm">
                Aujourd'hui
              </span>
            ) : (
              <Maximize2 className="h-3.5 w-3.5 text-muted-foreground/60 opacity-0 group-hover/card:opacity-100 transition-opacity" />
            )}
          </div>

          {/* Progress bar — subtle motivation */}
          {totalCount > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-medium text-muted-foreground">
                  {completedCount}/{totalCount} {progressPct === 100 && "✓"}
                </span>
                <span className={cn(
                  "font-bold tabular-nums",
                  progressPct === 100 ? "text-emerald-600 dark:text-emerald-400"
                    : progressPct >= 50 ? "text-primary"
                    : "text-muted-foreground"
                )}>
                  {progressPct}%
                </span>
              </div>
              <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    progressPct === 100
                      ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
                      : "bg-gradient-to-r from-primary/70 to-primary"
                  )}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </button>

        <CardContent className="p-2.5 flex-1 flex flex-col gap-2.5">
          {/* Priorités — premium, minimal */}
          <section className="rounded-lg border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 px-2 py-1.5">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-amber-500">★</span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Top 2 priorités
              </span>
            </div>
            <div className="space-y-1">
              {priorities.map((t: any) => (
                <div
                  key={t.id}
                  className={cn(
                    "flex items-center gap-2 group/item rounded-md px-1.5 py-1 transition-all",
                    t.completed && "bg-emerald-500/10 ring-1 ring-emerald-500/30"
                  )}
                >
                  <Checkbox checked={t.completed} onCheckedChange={() => toggleDailyTask(t.id, t.completed)} className="h-4 w-4" />
                  {t.completed && <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                  <EditableText
                    value={t.title}
                    onSave={(v) => renameDailyTask(t.id, v)}
                    className={cn(
                      "text-[13px] font-semibold flex-1 leading-snug",
                      t.completed && "text-emerald-700/80 dark:text-emerald-400/80"
                    )}
                  />
                  <button onClick={() => deleteDailyTask(t.id)} className="opacity-0 group-hover/item:opacity-100 text-destructive shrink-0 transition-opacity">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {priorities.length < 2 && (
                <Input
                  placeholder={priorities.length === 0 ? "+ Priorité #1" : "+ Priorité #2"}
                  value={newDayPriority[dateStr] || ""}
                  onChange={(e) => setNewDayPriority((prev) => ({ ...prev, [dateStr]: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && addDayPriority(dateStr)}
                  className="h-6 text-[10px] border-dashed bg-transparent border-amber-300/50"
                />
              )}
            </div>
          </section>

          {/* Récurrentes — collapsed chip with badge */}
          {showNonNego && recurringHabits.length > 0 && (
            <details className="group/rec rounded-lg border border-violet-200/60 dark:border-violet-900/40 bg-violet-50/40 dark:bg-violet-950/20">
              <summary className="flex items-center justify-between gap-2 px-2 py-1.5 cursor-pointer list-none select-none">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[10px]">🔁</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-400 truncate">
                    Récurrentes
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className={cn(
                    "text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full",
                    recurringDone === recurringHabits.length
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                      : "bg-violet-500/15 text-violet-700 dark:text-violet-400"
                  )}>
                    {recurringDone}/{recurringHabits.length}
                  </span>
                  <ChevronDown className="h-3 w-3 text-violet-500 transition-transform group-open/rec:rotate-180" />
                </div>
              </summary>
              <div className="px-2 pb-1.5 space-y-0.5">
                {recurringHabits.map((h: any) => {
                  const done = isHabitCompleted(h.id, dateStr);
                  return (
                    <label
                      key={h.id}
                      className={cn(
                        "flex items-center gap-2 py-1 px-1.5 rounded-md cursor-pointer transition-all",
                        done && "bg-emerald-500/10"
                      )}
                    >
                      <Checkbox checked={done} onCheckedChange={() => toggleHabitLog(h.id, dateStr)} className="h-3.5 w-3.5" />
                      {done && <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                      <span className={cn(
                        "text-[12px] font-medium leading-snug",
                        done && "text-emerald-700/80 dark:text-emerald-400/80"
                      )}>
                        {h.title}
                      </span>
                    </label>
                  );
                })}
              </div>
            </details>
          )}

          {/* Tasks list — clean, scannable */}
          <div className="flex-1 flex flex-col gap-1 min-h-0">
            {otherTasks.length === 0 && (
              <p className="text-[11px] text-muted-foreground/70 px-1 py-1">Aucune tâche pour ce jour</p>
            )}
            {otherTasks.map((t: any) => {
              const prio = t.priority || "normal";
              const prioCfg: any = {
                high: { color: "border-l-red-500 bg-red-50/40 dark:bg-red-950/20", dot: "bg-red-500", label: "Haute", next: "normal" },
                normal: { color: "border-l-blue-400/60", dot: "bg-blue-400", label: "Normale", next: "low" },
                low: { color: "border-l-slate-300 dark:border-l-slate-700 opacity-80", dot: "bg-slate-400", label: "Basse", next: "high" },
              };
              const cfg = prioCfg[prio];
              return (
                <div
                  key={t.id}
                  className={cn(
                    "flex items-start gap-2 px-2 py-1.5 rounded-md border-l-[3px] group/task cursor-grab active:cursor-grabbing transition-all",
                    t.completed
                      ? "bg-emerald-500/10 border border-emerald-500/20 border-l-emerald-500"
                      : cn("border border-transparent hover:bg-muted/60 hover:border-border/40", cfg.color)
                  )}
                  draggable
                  onDragStart={(e) => handleDragStart(e as any, t.id)}
                >
                  <Checkbox
                    checked={t.completed}
                    onCheckedChange={() => toggleDailyTask(t.id, t.completed)}
                    className="mt-0.5 h-4 w-4"
                  />
                  {t.completed && <Check className="mt-0.5 h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                  <TaskTitle title={t.title} completed={t.completed} onRename={(v) => renameDailyTask(t.id, v)} />
                  {!t.completed && (
                    <button
                      onClick={() => setTaskPriority(t.id, cfg.next)}
                      className={cn("h-2 w-2 rounded-full shrink-0 mt-1.5 transition-transform hover:scale-150", cfg.dot)}
                      title={`Priorité : ${cfg.label} (clique pour changer)`}
                    />
                  )}
                  <button
                    onClick={() => deleteDailyTask(t.id)}
                    className="opacity-0 group-hover/task:opacity-100 text-muted-foreground hover:text-destructive shrink-0 transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
            ))}
          </div>

          <Input
            placeholder="+ Ajouter une tâche"
            value={newTaskText[dateStr] || ""}
            onChange={(e) => setNewTaskText((prev) => ({ ...prev, [dateStr]: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && addSimpleDailyTask(dateStr)}
            className="h-8 text-xs border-dashed bg-transparent focus-visible:border-primary/50"
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
    <div className={cn("space-y-6 animate-fade-in", focusTasksOnly && "space-y-3")}>
      {!focusTasksOnly && (
        <div className="relative overflow-hidden rounded-2xl border border-amber-300/40 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-950/40 dark:via-yellow-950/30 dark:to-orange-950/40 p-5 shadow-sm">
          <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-amber-300/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-orange-300/20 blur-3xl pointer-events-none" />
          <div className="relative flex items-start gap-4">
            <div className="shrink-0 h-12 w-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Trophy className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" /> Mission de vie
              </p>
              <p className="text-sm sm:text-base font-bold leading-snug text-foreground">
                Atteindre la liberté financière <span className="text-amber-600 dark:text-amber-400">5–10K$/mois</span> grâce au business
                <span className="block text-xs sm:text-sm font-medium text-muted-foreground mt-0.5">— le cabinet n'est qu'un bonus.</span>
              </p>
            </div>
          </div>
        </div>
      )}
      {!focusTasksOnly && <PageHeader title="Objectifs & Tâches" description="Planifiez vos objectifs et tâches quotidiennes" />}

      {/* Action toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={focusTasksOnly ? "default" : "outline"}
          size="sm"
          className={cn("h-9 gap-2", !focusTasksOnly && "bg-gradient-to-r from-primary/10 to-primary/5 border-primary/30 hover:from-primary/20 hover:to-primary/10")}
          onClick={() => setFocusTasksOnly(!focusTasksOnly)}
        >
          {focusTasksOnly ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          <ListTodo className="h-4 w-4" />
          <span className="font-medium">{focusTasksOnly ? "Quitter plein écran" : "Plein écran tâches"}</span>
        </Button>
      </div>

      {!focusTasksOnly && (
        <>
          {/* Toggle goals visibility */}
          <Button
            variant="outline"
            className={cn(
              "w-full justify-between h-11 rounded-xl transition-all",
              showGoals
                ? "bg-gradient-to-r from-primary/15 to-primary/5 border-primary/40"
                : "bg-gradient-to-r from-muted/40 to-transparent hover:from-muted/60"
            )}
            onClick={() => setShowGoals(!showGoals)}
          >
            <span className="flex items-center gap-2.5">
              <span className={cn(
                "h-7 w-7 rounded-lg flex items-center justify-center transition-colors",
                showGoals ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                <Target className="h-4 w-4" />
              </span>
              <span className="font-semibold">Objectifs</span>
              <span className="text-xs text-muted-foreground hidden sm:inline">Annuel · 90j · Mois · Semaine</span>
            </span>
            {showGoals ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
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
                      <EditableText value={g.title} onSave={(v) => renameGoal(g.id, v)} className={cn("flex-1 text-sm", g.status === "achieved" && "line-through text-muted-foreground")} />
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
                          <EditableText value={g.title} onSave={(v) => renameGoal(g.id, v)} className={cn("flex-1 text-sm", g.status === "achieved" && "line-through text-muted-foreground")} />
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
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4" style={{ color: "hsl(var(--kpi-revenue))" }} />
                      Objectifs du mois ({format(now, "MMMM", { locale: fr })}) — {goalsMonthly.length}
                    </CardTitle>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={duplicateMonthlyToNext}>
                      <ChevronRight className="h-3 w-3 mr-1" /> Dupliquer → mois prochain
                    </Button>
                  </div>
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
                              <EditableText value={g.title} onSave={(v) => renameGoal(g.id, v)} className={cn("flex-1 text-xs", g.status === "achieved" && "line-through text-muted-foreground")} />
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
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Star className="h-4 w-4" style={{ color: "hsl(var(--kpi-suppliers))" }} />
                        Objectifs de la semaine — {goalsWeekly.length}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Semaine du {format(currentWeekStart, "d", { locale: fr })} au {format(weekEnd, "d MMMM", { locale: fr })}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={duplicateWeeklyToNext}>
                      <ChevronRight className="h-3 w-3 mr-1" /> Dupliquer → semaine prochaine
                    </Button>
                  </div>
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
                            <EditableText value={g.title} onSave={(v) => renameGoal(g.id, v)} className={cn("flex-1 text-sm font-medium", g.status === "achieved" && "line-through text-muted-foreground")} />
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
                              <EditableText value={g.title} onSave={(v) => renameGoal(g.id, v)} className={cn("flex-1 text-xs", g.status === "achieved" && "line-through text-muted-foreground")} />
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

          {/* Programme Sport et Dashboard Discipline déplacés vers leurs propres sections */}
        </>
      )}

      {/* Daily tasks */}
      <Card className="glass-card overflow-hidden border-primary/20">
        {(() => {
          const weekDateStrs = weekDays.map((d) => format(d, "yyyy-MM-dd"));
          const tasksThisWeek = dailyTasks.filter((t: any) => weekDateStrs.includes(t.day_date));
          const totalTasks = tasksThisWeek.length;
          const doneTasks = tasksThisWeek.filter((t: any) => t.completed).length;
          const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
          const todayStr = format(now, "yyyy-MM-dd");
          const isCurrentWeek = weekDateStrs.includes(todayStr);
          return (
            <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-b border-primary/10 px-4 sm:px-5 py-4">
              {/* Top row: title + week navigation */}
              <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md shadow-primary/30">
                    <CalendarDays className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold leading-tight">Tâches quotidiennes</h3>
                    <p className="text-[11px] text-muted-foreground leading-tight">
                      {doneTasks}/{totalTasks} accomplies cette semaine
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 rounded-lg border bg-background/60 backdrop-blur px-1 py-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs font-semibold whitespace-nowrap px-2">
                    {format(currentWeekStart, "d MMM", { locale: fr })} → {format(weekEnd, "d MMM", { locale: fr })}
                  </span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  {!isCurrentWeek && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[11px] font-semibold text-primary"
                      onClick={() => setCurrentWeekStart(startOfWeek(now, { weekStartsOn: 1 }))}
                    >
                      Aujourd'hui
                    </Button>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-3">
                <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] font-medium text-muted-foreground">Progression</span>
                  <span className="text-[10px] font-bold text-primary">{pct}%</span>
                </div>
              </div>

              {/* Action chips */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button variant="outline" size="sm" className="h-7 text-xs rounded-full bg-background/60 backdrop-blur" onClick={() => setHabitsSheetOpen(true)}>
                  <Star className="h-3.5 w-3.5 mr-1" /> Habitudes
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs rounded-full bg-background/60 backdrop-blur" onClick={() => setSalatSheetOpen(true)}>
                  <Settings2 className="h-3.5 w-3.5 mr-1" /> Horaires Salat
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs rounded-full bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-300 text-blue-700 hover:from-blue-100 hover:to-cyan-100 dark:from-blue-950/40 dark:to-cyan-950/40 dark:text-blue-300 dark:border-blue-800" onClick={copyTasksFromLastWeek}>
                  <ChevronRight className="h-3.5 w-3.5 mr-1" /> Copier semaine précédente
                </Button>
              </div>
            </div>
          );
        })()}
        <CardHeader className="hidden">
          <CardTitle />
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
            isMobile ? "grid-cols-1" : expandedDay ? "grid-cols-1" : "grid-cols-12"
          )}>
            {(isMobile
              ? (expandedDay ? weekDays.filter(d => format(d, "yyyy-MM-dd") === expandedDay) : visibleDays)
              : (expandedDay ? weekDays.filter(d => format(d, "yyyy-MM-dd") === expandedDay) : weekDays)
            ).map((day, idx) => {
              if (isMobile) return renderMobileDayCard(day);
              if (expandedDay) return renderDesktopDayCard(day);
              // Layout 3 + 4 : 3 premiers jours en col-span-4, 4 derniers en col-span-3
              const span = idx < 3 ? "col-span-4" : "col-span-3";
              return (
                <div key={format(day, "yyyy-MM-dd")} className={span}>
                  {renderDesktopDayCard(day)}
                </div>
              );
            })}
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
          <div className="space-y-4">
            {/* Personal non-negotiable */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "hsl(200, 60%, 50%)" }}>🔒 Non négociable Personnel</p>
              {dailyHabits.filter((h: any) => (h.category || "personal") === "personal").map((h: any) => (
                <div key={h.id} className="flex items-center gap-2 group mb-1">
                  {editingHabitId === h.id ? (
                    <Input autoFocus value={editingHabitTitle} onChange={(e) => setEditingHabitTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") updateDailyHabit(h.id, editingHabitTitle); if (e.key === "Escape") setEditingHabitId(null); }}
                      onBlur={() => updateDailyHabit(h.id, editingHabitTitle)} className="h-9 text-sm" />
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-medium">{h.title}</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingHabitId(h.id); setEditingHabitTitle(h.title); }}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteDailyHabit(h.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Business non-negotiable */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "hsl(30, 80%, 50%)" }}>💼 Non négociable Business</p>
              {dailyHabits.filter((h: any) => h.category === "business").map((h: any) => (
                <div key={h.id} className="flex items-center gap-2 group mb-1">
                  {editingHabitId === h.id ? (
                    <Input autoFocus value={editingHabitTitle} onChange={(e) => setEditingHabitTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") updateDailyHabit(h.id, editingHabitTitle); if (e.key === "Escape") setEditingHabitId(null); }}
                      onBlur={() => updateDailyHabit(h.id, editingHabitTitle)} className="h-9 text-sm" />
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-medium">{h.title}</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingHabitId(h.id); setEditingHabitTitle(h.title); }}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteDailyHabit(h.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Recurring per weekday */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "hsl(270, 60%, 50%)" }}>📅 Récurrentes (par jour de semaine)</p>
              {dailyHabits.filter((h: any) => h.category === "recurring").map((h: any) => {
                const days: number[] = h.days_of_week || [];
                const dayLabels = ["D", "L", "M", "M", "J", "V", "S"];
                const toggleDay = async (dow: number) => {
                  const next = days.includes(dow) ? days.filter((d) => d !== dow) : [...days, dow].sort();
                  setDailyHabits((prev) => prev.map((x) => x.id === h.id ? { ...x, days_of_week: next } : x));
                  await (supabase.from("daily_habits" as any) as any).update({ days_of_week: next } as any).eq("id", h.id);
                };
                return (
                  <div key={h.id} className="flex flex-col gap-1 group mb-2 border-b pb-2">
                    <div className="flex items-center gap-2">
                      {editingHabitId === h.id ? (
                        <Input autoFocus value={editingHabitTitle} onChange={(e) => setEditingHabitTitle(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") updateDailyHabit(h.id, editingHabitTitle); if (e.key === "Escape") setEditingHabitId(null); }}
                          onBlur={() => updateDailyHabit(h.id, editingHabitTitle)} className="h-9 text-sm" />
                      ) : (
                        <>
                          <span className="flex-1 text-sm font-medium">{h.title}</span>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingHabitId(h.id); setEditingHabitTitle(h.title); }}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteDailyHabit(h.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                        </>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {dayLabels.map((lbl, dow) => (
                        <button key={dow} type="button" onClick={() => toggleDay(dow)}
                          className={cn(
                            "h-7 w-7 rounded text-[11px] font-semibold border transition-colors",
                            days.includes(dow)
                              ? "bg-[hsl(270,60%,50%)] text-white border-[hsl(270,60%,50%)]"
                              : "bg-background text-muted-foreground hover:bg-muted"
                          )}>{lbl}</button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t space-y-2">
              <Select value={newHabitCategory} onValueChange={setNewHabitCategory}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">🔒 Personnel</SelectItem>
                  <SelectItem value="business">💼 Business</SelectItem>
                  <SelectItem value="recurring">📅 Récurrente (par jour)</SelectItem>
                </SelectContent>
              </Select>
              {newHabitCategory === "recurring" && (
                <div className="flex gap-1">
                  {["D", "L", "M", "M", "J", "V", "S"].map((lbl, dow) => (
                    <button key={dow} type="button"
                      onClick={() => setNewHabitDays((prev) => prev.includes(dow) ? prev.filter((d) => d !== dow) : [...prev, dow].sort())}
                      className={cn(
                        "h-7 w-7 rounded text-[11px] font-semibold border transition-colors",
                        newHabitDays.includes(dow)
                          ? "bg-[hsl(270,60%,50%)] text-white border-[hsl(270,60%,50%)]"
                          : "bg-background text-muted-foreground hover:bg-muted"
                      )}>{lbl}</button>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="Nouvelle habitude..."
                  value={newHabit}
                  onChange={(e) => setNewHabit(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addDailyHabit()}
                  className="h-9 text-sm"
                />
                <Button size="sm" className="h-9" onClick={() => { addDailyHabit(); setNewHabitDays([]); }}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
