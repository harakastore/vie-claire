import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

interface EditableTextProps {
  value: string;
  onSave: (newValue: string) => void;
  className?: string;
  inputClassName?: string;
  children?: React.ReactNode;
}

export function EditableText({ value, onSave, className, inputClassName, children }: EditableTextProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setText(value);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editing, value]);

  const save = () => {
    setEditing(false);
    const trimmed = text.trim();
    if (trimmed && trimmed !== value) {
      onSave(trimmed);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") save();
    if (e.key === "Escape") setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex-1 bg-transparent border-b border-primary/40 outline-none text-sm px-0 py-0",
          inputClassName
        )}
      />
    );
  }

  return (
    <span
      onDoubleClick={() => setEditing(true)}
      className={cn("cursor-pointer select-none", className)}
      title="Double-cliquez pour modifier"
    >
      {children || value}
    </span>
  );
}
