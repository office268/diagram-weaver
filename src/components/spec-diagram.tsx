import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { MermaidPreview } from "./mermaid-preview";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

interface Props {
  code: string;
  onChange: (code: string) => void;
}

export function SpecDiagram({ code, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(code);

  if (editing) {
    return (
      <div className="rounded-lg border border-border bg-card p-3">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={8}
          className="font-mono text-xs"
          dir="ltr"
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => { setDraft(code); setEditing(false); }}>
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
    <div className="group relative rounded-lg border border-border bg-card">
      <Button
        size="sm"
        variant="ghost"
        className="absolute left-2 top-2 z-10 h-7 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={() => { setDraft(code); setEditing(true); }}
      >
        <Pencil className="mr-1 h-3.5 w-3.5" /> ערוך תרשים
      </Button>
      <div className="h-[320px] w-full overflow-hidden">
        {code.trim() ? (
          <MermaidPreview code={code} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            אין תרשים. לחץ "ערוך תרשים" כדי להוסיף קוד Mermaid.
          </div>
        )}
      </div>
    </div>
  );
}
