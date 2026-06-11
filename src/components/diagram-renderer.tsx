// ============================================================
// src/components/diagram-renderer.tsx
// רכיב UI — diagram-renderer
// ============================================================
// Entry-point renderer: detects RF JSON (v1/v2) and renders, with edit toggle.
import { useCallback, useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DiagramRFEditor } from "@/components/diagram-rf-editor";
import { isDiagramRF, parseDiagramRF, type DiagramRFData, type LegacyActivityRFData } from "@/lib/diagram-rf";

interface Props {
  code: string;
  hideFullscreen?: boolean;
  onSave?: (newCode: string) => Promise<void>;
}

export function DiagramRenderer({ code, hideFullscreen, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const rfData = useMemo<DiagramRFData | LegacyActivityRFData | null>(
    () => (isDiagramRF(code) ? parseDiagramRF(code) : null),
    [code],
  );

  const handleSave = useCallback(
    async (updated: DiagramRFData | LegacyActivityRFData) => {
      if (!onSave) return;
      setSaving(true);
      try {
        await onSave(JSON.stringify(updated));
        toast.success("התרשים נשמר");
        setEditing(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "שמירה נכשלה");
      } finally {
        setSaving(false);
      }
    },
    [onSave],
  );

  if (!rfData) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
        תרשים זה בפורמט ישן ואינו ניתן עוד לצפייה. צור תרשים חדש.
      </div>
    );
  }

  if (editing) {
    return (
      <div className="relative h-full w-full">
        <div className="absolute left-2 top-2 z-20">
          <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
            ← חזרה לתצוגה
          </Button>
        </div>
        <DiagramRFEditor rfData={rfData} onSave={handleSave} saving={saving} />
      </div>
    );
  }

  return (
    <>
      <div className="relative flex h-full w-full flex-col overflow-hidden bg-background">
        <div className="relative flex-1 overflow-hidden">
          {onSave && (
            <div className="absolute right-3 top-3 z-10">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 shadow-sm"
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
                ערוך תרשים
              </Button>
            </div>
          )}
          <DiagramRFEditor rfData={rfData} readOnly />
        </div>
      </div>
      {!hideFullscreen && (
        <Dialog open={fullscreen} onOpenChange={setFullscreen}>
          <DialogContent className="h-[95vh] max-w-[95vw] p-0 sm:max-w-[95vw]">
            <DialogTitle className="sr-only">תצוגת תרשים במסך מלא</DialogTitle>
            <DialogDescription className="sr-only">תצוגה מלאה של התרשים.</DialogDescription>
            <div className="h-full w-full overflow-hidden rounded-lg">
              <DiagramRenderer code={code} hideFullscreen />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
