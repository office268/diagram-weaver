import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  getAiModelSetting,
  updateAiModelSetting,
} from "@/lib/ai-model-setting.functions";

const MODEL_LABELS: Record<string, string> = {
  "google/gemini-2.5-pro": "Gemini 2.5 Pro — Reasoning (ברירת מחדל)",
  "google/gemini-3.1-pro-preview": "Gemini 3.1 Pro Preview — Reasoning",
  "google/gemini-3-flash-preview": "Gemini 3 Flash Preview — מהיר וזול",
  "google/gemini-2.5-flash": "Gemini 2.5 Flash — מאוזן",
  "openai/gpt-5.4": "GPT-5.4 — Reasoning",
  "openai/gpt-5.4-pro": "GPT-5.4 Pro — Reasoning מתקדם",
  "openai/gpt-5.5": "GPT-5.5 — Reasoning מתקדם",
  "openai/gpt-5.5-pro": "GPT-5.5 Pro — Reasoning הכי איכותי",
};

export function AiModelSettingCard() {
  const qc = useQueryClient();
  const getFn = useServerFn(getAiModelSetting);
  const updateFn = useServerFn(updateAiModelSetting);

  const { data, isLoading } = useQuery({
    queryKey: ["ai-model-setting"],
    queryFn: () => getFn(),
  });

  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    if (data?.model && !selected) setSelected(data.model);
  }, [data?.model, selected]);

  const mutation = useMutation({
    mutationFn: (model: string) => updateFn({ data: { model } }),
    onSuccess: () => {
      toast.success("המודל עודכן בהצלחה");
      qc.invalidateQueries({ queryKey: ["ai-model-setting"] });
    },
    onError: (err: Error) => {
      toast.error("שמירת המודל נכשלה: " + err.message);
    },
  });

  const allowed = data?.allowed ?? [];
  const current = data?.model ?? "";
  const dirty = selected && selected !== current;

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="space-y-2">
          <Label htmlFor="ai-model-select" className="text-sm font-medium">
            מודל AI
          </Label>
          <p className="text-xs text-muted-foreground">
            המודל ישפיע על כל הסוכנים בעת חילול תוצרים (דרישות, ארכיטקטורה, מודל נתונים,
            תרחישי שימוש, דיאגרמות, ובקרת איכות). מודלי reasoning איכותיים יותר אך יקרים יותר.
          </p>
        </div>

        <Select
          value={selected || current}
          onValueChange={setSelected}
          disabled={isLoading || mutation.isPending}
          dir="rtl"
        >
          <SelectTrigger id="ai-model-select" className="w-full">
            <SelectValue placeholder="בחר מודל..." />
          </SelectTrigger>
          <SelectContent>
            {allowed.map((m) => (
              <SelectItem key={m} value={m}>
                {MODEL_LABELS[m] ?? m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {current ? <>נוכחי: <code className="font-mono">{current}</code></> : null}
          </div>
          <Button
            onClick={() => mutation.mutate(selected)}
            disabled={!dirty || mutation.isPending || isLoading}
          >
            {mutation.isPending ? "שומר..." : "שמור"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
