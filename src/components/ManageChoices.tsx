import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Settings2, Plus, Trash2 } from "lucide-react";

interface ManageChoicesProps {
  fieldType: string;
  label: string;
}

export function ManageChoices({ fieldType, label }: ManageChoicesProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<{ id: string; value: string }[]>([]);
  const [newValue, setNewValue] = useState("");

  const fetchItems = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("autocomplete_library")
      .select("id, value")
      .eq("field_type", fieldType)
      .order("value");
    setItems(data || []);
  };

  useEffect(() => {
    if (open) fetchItems();
  }, [open, user]);

  const addItem = async () => {
    if (!user || !newValue.trim()) return;
    const { error } = await supabase.from("autocomplete_library").upsert(
      { user_id: user.id, field_type: fieldType, value: newValue.trim(), last_used_at: new Date().toISOString() },
      { onConflict: "user_id,field_type,value" }
    );
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else { setNewValue(""); fetchItems(); }
  };

  const removeItem = async (id: string) => {
    await supabase.from("autocomplete_library").delete().eq("id", id);
    fetchItems();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" type="button">
          <Settings2 className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Gérer : {label}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div className="flex gap-2">
            <Input
              placeholder="Ajouter un choix..."
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem())}
              className="h-8 text-sm"
            />
            <Button size="sm" className="h-8" onClick={addItem}><Plus className="h-3.5 w-3.5" /></Button>
          </div>
          <div className="max-h-60 overflow-auto space-y-1">
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun choix enregistré</p>
            ) : (
              items.map((item) => (
                <div key={item.id} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted/50 group">
                  <span className="text-sm">{item.value}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => removeItem(item.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
