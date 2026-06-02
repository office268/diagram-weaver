import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "./ui/button";

interface Props {
  value: string;
  onChange: (next: string) => void;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
}

export const EditableItemDeleteContext = createContext<(() => void) | null>(null);

export function EditableText({ value, onChange, multiline, placeholder, className }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  const onDelete = useContext(EditableItemDeleteContext);

  // Sync external value changes when not focused
  useEffect(() => {
    if (!focused) setDraft(value);
  }, [value, focused]);

  // Auto-resize textarea
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
    <div className="group/editable relative">
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
      {onDelete ? (
        <Button
          size="sm"
          variant="ghost"
          className="absolute -left-1 top-0 h-7 w-7 p-0 text-destructive opacity-0 transition-opacity group-hover/editable:opacity-100 hover:bg-destructive/10 hover:text-destructive"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onDelete}
          title="מחק"
          aria-label="מחק"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ) : null}
    </div>
  );
}
