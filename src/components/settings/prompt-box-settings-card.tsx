// ============================================================
// src/components/prompt-box-settings-card.tsx
// רכיב UI — prompt-box-settings-card
// ============================================================
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_PROMPT_BOX_SETTINGS,
  clampRows,
  loadPromptBoxSettings,
  savePromptBoxSettings,
  type PromptBoxSettings,
} from "@/lib/prompt-box-settings";

export function PromptBoxSettingsCard() {
  const [s, setS] = useState<PromptBoxSettings>(DEFAULT_PROMPT_BOX_SETTINGS);

  useEffect(() => {
    setS(loadPromptBoxSettings());
  }, []);

  const update = (patch: Partial<PromptBoxSettings>) =>
    setS((prev) => ({ ...prev, ...patch }));

  const handleSave = () => {
    const hasMode = Object.values(s.allowedModes).some(Boolean);
    if (!hasMode) {
      toast.error("יש לאפשר לפחות מצב אחד");
      return;
    }
    const normalized: PromptBoxSettings = { ...s, rows: clampRows(s.rows) };
    savePromptBoxSettings(normalized);
    setS(normalized);
    toast.success("נשמר");
  };

  const handleReset = () => {
    setS(DEFAULT_PROMPT_BOX_SETTINGS);
    savePromptBoxSettings(DEFAULT_PROMPT_BOX_SETTINGS);
    toast.success("שוחזר לברירת מחדל");
  };

  return (
    <Card>
      <CardContent className="space-y-6 pt-6">
        <div className="space-y-2">
          <Label htmlFor="prompt-rows">כמה שורות בתיבת הפרומפט</Label>
          <Input
            id="prompt-rows"
            type="number"
            min={1}
            max={8}
            value={s.rows}
            onChange={(e) => update({ rows: clampRows(Number(e.target.value)) })}
            className="w-24"
          />
          <p className="text-xs text-muted-foreground">בין 1 ל-8 שורות.</p>
        </div>

        <div className="space-y-3">
          <Label>מה ניתן להעלות</Label>
          <div className="space-y-2">
            <ToggleRow
              label="קובץ"
              checked={s.allowedUploads.file}
              onChange={(v) =>
                update({ allowedUploads: { ...s.allowedUploads, file: v } })
              }
            />
            <ToggleRow
              label="תמונה"
              checked={s.allowedUploads.image}
              onChange={(v) =>
                update({ allowedUploads: { ...s.allowedUploads, image: v } })
              }
            />
            <ToggleRow
              label="קישור"
              checked={s.allowedUploads.link}
              onChange={(v) =>
                update({ allowedUploads: { ...s.allowedUploads, link: v } })
              }
            />
          </div>
        </div>

        <div className="space-y-3">
          <Label>מצבים מאופשרים</Label>
          <div className="space-y-2">
            <ToggleRow
              label="Auto"
              description="ה-AI מחליט אם לשאול הבהרות או לייצר ישר."
              checked={s.allowedModes.auto}
              onChange={(v) =>
                update({ allowedModes: { ...s.allowedModes, auto: v } })
              }
            />
            <ToggleRow
              label="Plan"
              description="שאלות הבהרה והצעת מבנה בלבד."
              checked={s.allowedModes.plan}
              onChange={(v) =>
                update({ allowedModes: { ...s.allowedModes, plan: v } })
              }
            />
            <ToggleRow
              label="Build"
              description="מייצר את המסמך/תרשים ישר לפי הבקשה."
              checked={s.allowedModes.build}
              onChange={(v) =>
                update({ allowedModes: { ...s.allowedModes, build: v } })
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="prompt-default">משפט ברירת מחדל</Label>
          <Textarea
            id="prompt-default"
            value={s.defaultPlaceholder}
            onChange={(e) => update({ defaultPlaceholder: e.target.value })}
            rows={2}
            placeholder="לדוגמה: תאר/י את המסמך שתרצה ליצור..."
          />
          <p className="text-xs text-muted-foreground">
            ישמש כטקסט פתיחה (placeholder) בתיבת הפרומפט. השאר ריק כדי להשתמש בברירת המחדל של המערכת.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={handleReset}>
            שחזר ברירת מחדל
          </Button>
          <Button onClick={handleSave}>שמור</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-border bg-card/40 px-3 py-2">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {description ? (
          <div className="text-xs text-muted-foreground">{description}</div>
        ) : null}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
