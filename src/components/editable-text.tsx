import { createContext, useContext, useState } from "react";
import { Check, X, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Input } from "./ui/input";

interface Props {
  value: string;
  onChange: (next: string) => void;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
}

export const EditableItemDeleteContext = createContext<(() => void) | null>(null);

export function EditableText({ value, onChange, multiline, placeholder, className }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const onDelete = useContext(EditableItemDeleteContext);

  if (editing) {
    return (
      <div className="space-y-2">
        {multiline ? (
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            placeholder={placeholder}
            autoFocus
          />
        ) : (
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            autoFocus
          />
        )}
        <div className="flex items-center justify-end gap-2">
          {onDelete ? (
            <Button
              size="sm"
              variant="ghost"
              className="mr-auto h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onDelete}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" /> מחק
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={() => { setDraft(value); setEditing(false); }}>
            <X className="mr-1 h-3.5 w-3.5" /> ביטול
          </Button>
          <Button size="sm" onClick={() => { onChange(draft); setEditing(false); }}>
            <Check className="mr-1 h-3.5 w-3.5" /> שמירה
          </Button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      data-editable-trigger="true"
      onClick={() => { setDraft(value); setEditing(true); }}
      className={`block w-full cursor-text whitespace-pre-wrap rounded-md p-1 text-right text-foreground transition-colors hover:bg-muted/50 ${className ?? ""}`}
      title="לחץ לעריכה"
    >
      {value || <span className="text-muted-foreground">{placeholder ?? "ריק"}</span>}
    </button>
  );
}
