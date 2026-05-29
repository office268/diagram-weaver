import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";
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

export function EditableText({ value, onChange, multiline, placeholder, className }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

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
        <div className="flex justify-end gap-2">
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
    <div className={`group flex items-start gap-2 ${className ?? ""}`}>
      <div className="flex-1 whitespace-pre-wrap text-foreground">
        {value || <span className="text-muted-foreground">{placeholder ?? "ריק"}</span>}
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={() => { setDraft(value); setEditing(true); }}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
