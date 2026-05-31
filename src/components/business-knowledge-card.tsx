import { useEffect, useRef, useState } from "react";
import { Loader2, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const MAX_LEN = 10000;

interface Props {
  label: string;
  description?: string;
  placeholder?: string;
  value: string;
  isLoading?: boolean;
  onSave: (next: string) => Promise<void>;
}

export function BusinessKnowledgeCard({
  label,
  description,
  placeholder,
  value,
  isLoading,
  onSave,
}: Props) {
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      setDraft(value ?? "");
      if (!isLoading) initialized.current = true;
    }
  }, [value, isLoading]);

  const dirty = draft !== (value ?? "");

  async function handleSave() {
    if (draft.length > MAX_LEN) {
      toast.error(`הטקסט ארוך מדי (מקסימום ${MAX_LEN} תווים)`);
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
      toast.success("נשמר");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "שמירה נכשלה");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="space-y-1">
          <Label className="text-sm font-medium text-foreground">{label}</Label>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <Textarea
          dir="auto"
          rows={10}
          value={draft}
          maxLength={MAX_LEN}
          placeholder={
            placeholder ??
            "לדוגמה: תחום העיסוק, מוצרים מרכזיים, קהלי יעד, מונחים פנימיים, אילוצים רגולטוריים, מערכות קיימות..."
          }
          onChange={(e) => setDraft(e.target.value)}
          className="min-h-[180px] text-sm leading-relaxed"
          disabled={isLoading}
        />
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            <span>נשלח אוטומטית ל-AI עם כל יצירה/ביקורת/שיפור.</span>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`text-xs ${
                draft.length > MAX_LEN * 0.95
                  ? "text-destructive"
                  : "text-muted-foreground"
              }`}
            >
              {draft.length.toLocaleString()} / {MAX_LEN.toLocaleString()}
            </span>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!dirty || saving || isLoading}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              שמירה
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
