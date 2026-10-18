import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Pencil, List, Table2, Check, X, Trophy, Sparkles, Route, CheckSquare } from "lucide-react";

type Item = { id: string; text: string; detail?: string; color: string; completed?: boolean };
type Board = { id: string; title: string; display: "list" | "table" | "roadmap" | "checklist"; color: string; items: Item[]; sort_order: number };

const COLORS: Record<string, { dot: string; chip: string; row: string }> = {
  amber: { dot: "bg-amber-500", chip: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800", row: "bg-amber-50 dark:bg-amber-950/30 border-l-amber-500" },
  violet: { dot: "bg-violet-500", chip: "bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800", row: "bg-violet-50 dark:bg-violet-950/30 border-l-violet-500" },
  blue: { dot: "bg-blue-500", chip: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800", row: "bg-blue-50 dark:bg-blue-950/30 border-l-blue-500" },
  emerald: { dot: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800", row: "bg-emerald-50 dark:bg-emerald-950/30 border-l-emerald-500" },
  rose: { dot: "bg-rose-500", chip: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800", row: "bg-rose-50 dark:bg-rose-950/30 border-l-rose-500" },
};
const DEFAULT_MISSION = "Atteindre la liberté financière 5–10K$/mois grâce au business — le cabinet n'est qu'un bonus.";
const uid = () => crypto.randomUUID();

function ColorPick({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return <div className="flex gap-1.5">{Object.keys(COLORS).map(c => (
    <button key={c} type="button" aria-label={c} onClick={() => onChange(c)}
      className={cn("h-5 w-5 rounded-full", COLORS[c].dot, value === c && "ring-2 ring-offset-2 ring-foreground")} />
  ))}</div>;
}

export function MissionBoards() {
  const { user } = useAuth();
  const [mission, setMission] = useState(DEFAULT_MISSION);
  const [editingMission, setEditingMission] = useState(false);
  const [draft, setDraft] = useState("");
  const [boards, setBoards] = useState<Board[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: m }, { data: b }] = await Promise.all([
        supabase.from("life_mission").select("mission_text").eq("user_id", user.id).maybeSingle(),
        supabase.from("mission_boards").select("*").order("sort_order"),
      ]);
      if (m?.mission_text) setMission(m.mission_text);
      let list = (b || []) as unknown as Board[];
      if (!list.length) {
        const { data: created } = await supabase.from("mission_boards")
          .insert({ user_id: user.id, title: "AFFIRMATION", color: "amber", display: "list", sort_order: 0 }).select().single();
        if (created) list = [created as unknown as Board];
      }
      setBoards(list);
    })();
  }, [user]);

  const saveMission = async () => {
    const v = draft.trim();
    setEditingMission(false);
    if (!v || !user || v === mission) return;
    const prev = mission; setMission(v);
    const { error } = await supabase.from("life_mission").upsert({ user_id: user.id, mission_text: v, updated_at: new Date().toISOString() });
    if (error) { setMission(prev); toast({ title: "Erreur", description: error.message, variant: "destructive" }); }
  };

  const updateBoard = async (id: string, patch: Partial<Board>) => {
    const prev = boards;
    setBoards(bs => bs.map(b => b.id === id ? { ...b, ...patch } : b));
    const { error } = await supabase.from("mission_boards").update({ ...(patch as any), updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { setBoards(prev); toast({ title: "Erreur", description: error.message, variant: "destructive" }); }
  };

  const createBoard = async () => {
    const t = newTitle.trim(); if (!t || !user) return;
    const { data, error } = await supabase.from("mission_boards")
      .insert({ user_id: user.id, title: t, color: "violet", display: "list", sort_order: boards.length }).select().single();
    if (error) return toast({ title: "Erreur", description: error.message, variant: "destructive" });
    if (!data) return;
    setBoards(bs => [...bs, data as unknown as Board]); setNewTitle(""); setCreating(false); setOpenId(data.id);
  };

  const deleteBoard = async (id: string) => {
    if (!confirm("Supprimer ce bouton et son contenu ?")) return;
    const prev = boards; setBoards(bs => bs.filter(b => b.id !== id)); setOpenId(null);
    const { error } = await supabase.from("mission_boards").delete().eq("id", id);
    if (error) setBoards(prev);
  };

  const open = boards.find(b => b.id === openId) || null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-300/40 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-950/40 dark:via-yellow-950/30 dark:to-orange-950/40 p-5 shadow-sm">
      <div className="relative flex items-start gap-4">
        <div className="shrink-0 h-12 w-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
          <Trophy className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" /> Mission de vie
          </p>
          {editingMission ? (
            <div className="space-y-2">
              <Textarea autoFocus value={draft} onChange={e => setDraft(e.target.value)} rows={2}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveMission(); } if (e.key === "Escape") setEditingMission(false); }} />
              <div className="flex gap-2"><Button size="sm" onClick={saveMission}><Check className="h-3.5 w-3.5 mr-1" />Enregistrer</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingMission(false)}>Annuler</Button></div>
            </div>
          ) : (
            <div className="group flex items-start gap-2">
              <p onDoubleClick={() => { setDraft(mission); setEditingMission(true); }} title="Double-cliquez pour modifier"
                className="text-sm sm:text-base font-bold leading-snug text-foreground cursor-pointer whitespace-pre-wrap">{mission}</p>
              <button aria-label="Modifier la mission" onClick={() => { setDraft(mission); setEditingMission(true); }}
                className="opacity-60 hover:opacity-100 shrink-0 mt-0.5"><Pencil className="h-3.5 w-3.5" /></button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {boards.map(b => (
              <Button key={b.id} variant="outline" size="sm" onClick={() => setOpenId(b.id)}
                className={cn("h-auto max-w-full px-3 py-1.5 rounded-full text-xs font-bold uppercase whitespace-normal break-words", COLORS[b.color]?.chip)}>
                {b.display === "checklist" && <CheckSquare className="h-3.5 w-3.5 mr-1 shrink-0" />}
                {b.title} <span className="opacity-60 font-medium">· {b.display === "checklist" ? `${b.items.filter(i => i.completed).length}/` : ""}{b.items.length}</span>
              </Button>
            ))}
            {creating ? (
              <div className="flex items-center gap-1">
                <Input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Ex : GRATITUDES" className="h-8 w-40 text-xs"
                  onKeyDown={e => { if (e.key === "Enter") createBoard(); if (e.key === "Escape") setCreating(false); }} />
                <Button size="icon" className="h-8 w-8" onClick={createBoard}><Check className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setCreating(false)}><X className="h-3.5 w-3.5" /></Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" className="h-8 rounded-full text-xs" onClick={() => setCreating(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" />Nouveau bouton
              </Button>
            )}
          </div>
        </div>
      </div>
      {open && <BoardDialog board={open} onClose={() => setOpenId(null)} onUpdate={p => updateBoard(open.id, p)} onDelete={() => deleteBoard(open.id)} />}
    </div>
  );
}

function BoardDialog({ board, onClose, onUpdate, onDelete }: { board: Board; onClose: () => void; onUpdate: (p: Partial<Board>) => void; onDelete: () => void }) {
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState(""); const [detail, setDetail] = useState(""); const [color, setColor] = useState(board.color);
  const [editItem, setEditItem] = useState<string | null>(null);
  const [title, setTitle] = useState(board.title);

  const setItems = (items: Item[]) => onUpdate({ items });
  const add = () => {
    if (!text.trim()) return;
    setItems([...board.items, { id: uid(), text: text.trim(), detail: detail.trim() || undefined, color }]);
    setText(""); setDetail("");
  };
  const patchItem = (id: string, p: Partial<Item>) => setItems(board.items.map(i => i.id === id ? { ...i, ...p } : i));

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className={cn("h-3 w-3 rounded-full", COLORS[board.color]?.dot)} />
            {edit ? <Input value={title} onChange={e => setTitle(e.target.value)} onBlur={() => title.trim() && onUpdate({ title: title.trim() })} className="h-8" /> : board.title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 border-b pb-3">
          <div className="flex flex-wrap rounded-lg border p-0.5">
            <Button size="sm" variant={board.display === "list" ? "default" : "ghost"} className="h-7" onClick={() => onUpdate({ display: "list" })}><List className="h-3.5 w-3.5 mr-1" />Liste</Button>
            <Button size="sm" variant={board.display === "table" ? "default" : "ghost"} className="h-7" onClick={() => onUpdate({ display: "table" })}><Table2 className="h-3.5 w-3.5 mr-1" />Tableau</Button>
            <Button size="sm" variant={board.display === "roadmap" ? "default" : "ghost"} className="h-7" onClick={() => onUpdate({ display: "roadmap" })}><Route className="h-3.5 w-3.5 mr-1" />Roadmap</Button>
            <Button size="sm" variant={board.display === "checklist" ? "default" : "ghost"} className="h-7" onClick={() => onUpdate({ display: "checklist" })}><CheckSquare className="h-3.5 w-3.5 mr-1" />Checklist</Button>
          </div>
          <Button size="sm" variant={edit ? "default" : "outline"} className="h-8" onClick={() => setEdit(!edit)}>
            <Pencil className="h-3.5 w-3.5 mr-1" />{edit ? "Terminer" : "Modifier"}
          </Button>
          {edit && <><span className="text-xs text-muted-foreground ml-2">Couleur du bouton</span><ColorPick value={board.color} onChange={c => onUpdate({ color: c })} />
            <Button size="sm" variant="ghost" className="h-8 ml-auto text-destructive" onClick={onDelete}><Trash2 className="h-3.5 w-3.5 mr-1" />Supprimer</Button></>}
        </div>

        {board.items.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Rien encore. Cliquez sur « Modifier » pour écrire.</p>}

        {board.display === "checklist" ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{board.items.filter(i => i.completed).length} / {board.items.length} faits</p>
            <ul className="space-y-2">
              {board.items.map(i => (
                <li key={i.id} className={cn("rounded-lg border-l-4 px-4 py-3", COLORS[i.color]?.row)}>
                  {editItem === i.id ? <ItemEditor item={i} onSave={p => { patchItem(i.id, p); setEditItem(null); }} onCancel={() => setEditItem(null)} /> : (
                    <div className="flex items-start gap-3">
                      <Checkbox className="mt-1 shrink-0" aria-label={`Fait : ${i.text}`} checked={Boolean(i.completed)} onCheckedChange={checked => patchItem(i.id, { completed: checked === true })} />
                      <div className="flex-1 min-w-0 break-words">
                        <p className={cn("font-semibold whitespace-pre-wrap", i.completed && "line-through text-muted-foreground")}>{i.text}</p>
                        <p className="text-xs text-muted-foreground mt-1">{i.completed ? "Fait" : "Pas fait"}</p>
                        {i.detail && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{i.detail}</p>}
                      </div>
                      {edit && <ItemActions onEdit={() => setEditItem(i.id)} onDelete={() => setItems(board.items.filter(x => x.id !== i.id))} />}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : board.display === "roadmap" ? (
          <ol className="relative space-y-4 border-l-2 border-border ml-4 pl-6 py-2">
            {board.items.map((i, idx) => (
              <li key={i.id} className="relative min-w-0">
                <span className={cn("absolute -left-10 top-3 flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold", COLORS[i.color]?.chip)}>{idx + 1}</span>
                <div className={cn("rounded-lg border-l-4 px-4 py-3", COLORS[i.color]?.row)}>
                  {editItem === i.id ? <ItemEditor item={i} onSave={p => { patchItem(i.id, p); setEditItem(null); }} onCancel={() => setEditItem(null)} /> : (
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0 break-words"><p className="font-semibold whitespace-pre-wrap">{i.text}</p>{i.detail && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{i.detail}</p>}</div>
                      {edit && <ItemActions onEdit={() => setEditItem(i.id)} onDelete={() => setItems(board.items.filter(x => x.id !== i.id))} />}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        ) : board.display === "list" ? (
          <ul className="space-y-2">
            {board.items.map(i => (
              <li key={i.id} className={cn("rounded-lg border-l-4 px-4 py-3", COLORS[i.color]?.row)}>
                {editItem === i.id ? <ItemEditor item={i} onSave={p => { patchItem(i.id, p); setEditItem(null); }} onCancel={() => setEditItem(null)} /> : (
                  <div className="flex items-start gap-2">
                    <div className="flex-1"><p className="font-semibold text-base whitespace-pre-wrap">{i.text}</p>{i.detail && <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">{i.detail}</p>}</div>
                    {edit && <ItemActions onEdit={() => setEditItem(i.id)} onDelete={() => setItems(board.items.filter(x => x.id !== i.id))} />}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : board.items.length > 0 && (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted"><tr><th className="text-left px-3 py-2 w-8">#</th><th className="text-left px-3 py-2">Élément</th><th className="text-left px-3 py-2">Détail</th>{edit && <th className="w-20" />}</tr></thead>
              <tbody>{board.items.map((i, idx) => (
                <tr key={i.id} className={cn("border-t border-l-4", COLORS[i.color]?.row)}>
                  {editItem === i.id ? <td colSpan={4} className="p-3"><ItemEditor item={i} onSave={p => { patchItem(i.id, p); setEditItem(null); }} onCancel={() => setEditItem(null)} /></td> : <>
                    <td className="px-3 py-2 text-muted-foreground tabular-nums">{idx + 1}</td>
                    <td className="px-3 py-2 font-semibold whitespace-pre-wrap">{i.text}</td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-pre-wrap">{i.detail}</td>
                    {edit && <td className="px-2"><ItemActions onEdit={() => setEditItem(i.id)} onDelete={() => setItems(board.items.filter(x => x.id !== i.id))} /></td>}
                  </>}
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {edit && (
          <div className="rounded-lg border border-dashed p-3 space-y-2">
            <Input value={text} onChange={e => setText(e.target.value)} placeholder="Ex : Je suis discipliné et constant" onKeyDown={e => e.key === "Enter" && add()} />
            <Input value={detail} onChange={e => setDetail(e.target.value)} placeholder="Détail (optionnel)" onKeyDown={e => e.key === "Enter" && add()} />
            <div className="flex items-center justify-between"><ColorPick value={color} onChange={setColor} /><Button size="sm" onClick={add}><Plus className="h-3.5 w-3.5 mr-1" />Ajouter</Button></div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ItemActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return <div className="flex gap-1 shrink-0">
    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit} aria-label="Modifier"><Pencil className="h-3.5 w-3.5" /></Button>
    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onDelete} aria-label="Supprimer"><Trash2 className="h-3.5 w-3.5" /></Button>
  </div>;
}

function ItemEditor({ item, onSave, onCancel }: { item: Item; onSave: (p: Partial<Item>) => void; onCancel: () => void }) {
  const [t, setT] = useState(item.text); const [d, setD] = useState(item.detail || ""); const [c, setC] = useState(item.color);
  return <div className="space-y-2">
    <Input value={t} onChange={e => setT(e.target.value)} autoFocus />
    <Input value={d} onChange={e => setD(e.target.value)} placeholder="Détail" />
    <div className="flex items-center justify-between"><ColorPick value={c} onChange={setC} />
      <div className="flex gap-1"><Button size="sm" variant="ghost" onClick={onCancel}>Annuler</Button>
        <Button size="sm" onClick={() => t.trim() && onSave({ text: t.trim(), detail: d.trim() || undefined, color: c })}>OK</Button></div></div>
  </div>;
}
