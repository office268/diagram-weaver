// ============================================================
// src/components/editable-text.tsx
// רכיב UI — editable-text
// ============================================================
import { createContext, useEffect, useRef, useState } from "react";

interface Props {
  value: string;
  onChange: (next: string) => void;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
}

// Kept for backward compatibility with any importers; no longer used.
export const EditableItemDeleteContext = createContext<(() => void) | null>(null);

export function EditableText({ value, onChange, multiline, placeholder, className }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(value);
  }, [value, focused]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [draft]);

  const commit = () => {
    if (draft !== value) onChange(draft);
  };

  return (
    <textarea
      ref={ref}
      value={draft}
      rows={1}
      dir="auto"
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); commit(); }}
      onKeyDown={(e) => {
        if (!multiline && e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLTextAreaElement).blur();
        }
      }}
      className={
        "block w-full resize-none bg-transparent p-0 text-right text-foreground outline-none border-0 focus:ring-0 placeholder:text-muted-foreground/60 whitespace-pre-wrap " +
        (className ?? "")
      }
    />
  );
}
