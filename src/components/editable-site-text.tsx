import { useEffect, useRef, useState, type ElementType } from "react";
import { useSiteTexts } from "@/lib/site-texts-context";
import { cn } from "@/lib/utils";

type Tag = "h1" | "h2" | "h3" | "h4" | "p" | "span" | "div";

interface Props {
  textKey: string;
  defaultValue: string;
  as?: Tag;
  multiline?: boolean;
  className?: string;
}

export function EditableSiteText({
  textKey,
  defaultValue,
  as = "span",
  multiline = false,
  className,
}: Props) {
  const { texts, isAdmin, updateText } = useSiteTexts();
  const current = texts[textKey] ?? defaultValue;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(current);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!editing) setDraft(current);
  }, [current, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft;
    if (trimmed !== current) {
      void updateText(textKey, trimmed);
    }
  };

  const cancel = () => {
    setDraft(current);
    setEditing(false);
  };

  if (editing) {
    const sharedCls = cn(
      "w-full rounded border border-primary bg-background px-1.5 py-0.5 outline-none focus:ring-2 focus:ring-primary/40",
      className,
    );
    if (multiline) {
      return (
        <textarea
          ref={(el) => { inputRef.current = el; }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.preventDefault(); cancel(); }
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); }
          }}
          rows={Math.max(2, Math.min(10, draft.split("\n").length + 1))}
          dir="auto"
          className={sharedCls}
        />
      );
    }
    return (
      <input
        ref={(el) => { inputRef.current = el; }}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Escape") { e.preventDefault(); cancel(); }
          if (e.key === "Enter") { e.preventDefault(); commit(); }
        }}
        dir="auto"
        className={sharedCls}
      />
    );
  }

  const Comp = as as React.ElementType;
  return (
    <Comp
      className={cn(
        className,
        isAdmin &&
          "cursor-text rounded outline-dashed outline-1 outline-transparent transition-colors hover:outline-primary/60",
      )}
      title={isAdmin ? "דאבל-קליק לעריכה" : undefined}
      onDoubleClick={isAdmin ? () => setEditing(true) : undefined}
    >
      {current}
    </Comp>
  );
}
