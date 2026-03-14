import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface AutocompleteInputProps {
  fieldType: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function AutocompleteInput({ fieldType, value, onChange, placeholder, className }: AutocompleteInputProps) {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || !value || value.length < 1) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("autocomplete_library")
        .select("value")
        .eq("field_type", fieldType)
        .ilike("value", `%${value}%`)
        .order("last_used_at", { ascending: false })
        .limit(8);
      setSuggestions(data?.map((d) => d.value) || []);
    }, 150);
    return () => clearTimeout(timer);
  }, [value, fieldType, user]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex((i) => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && selectedIndex >= 0) { e.preventDefault(); select(suggestions[selectedIndex]); }
    else if (e.key === "Escape") setShowSuggestions(false);
  };

  const select = (val: string) => {
    onChange(val);
    setShowSuggestions(false);
    setSelectedIndex(-1);
  };

  return (
    <div ref={ref} className="relative">
      <Input
        value={value}
        onChange={(e) => { onChange(e.target.value); setShowSuggestions(true); setSelectedIndex(-1); }}
        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md max-h-48 overflow-auto">
          {suggestions.map((s, i) => (
            <button
              key={s}
              className={cn(
                "w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors",
                i === selectedIndex && "bg-accent"
              )}
              onClick={() => select(s)}
              type="button"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export async function saveAutocomplete(userId: string, fieldType: string, value: string) {
  if (!value.trim()) return;
  await supabase.from("autocomplete_library").upsert(
    { user_id: userId, field_type: fieldType, value: value.trim(), last_used_at: new Date().toISOString() },
    { onConflict: "user_id,field_type,value" }
  );
}
