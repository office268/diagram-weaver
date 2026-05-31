import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, RotateCcw, Sparkles } from "lucide-react";
import {
  getAiSettings,
  updateAiSettings,
  resetAiSettings,
} from "@/lib/ai-settings.functions";
import { COMPARISON_MODELS, OUTPUT_SCHEMA_FIELDS } from "@/lib/ai-spec-defaults";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AppMetadataCard } from "@/components/app-metadata-card";
import { EditableSiteText } from "@/components/editable-site-text";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "הגדרות AI — סוכן ניתוח מערכות" },
      { name: "description", content: "עריכת ה-system instruction ותצוגת הפרומפט שנשלח ל-LLM." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const getFn = useServerFn(getAiSettings);
  const updateFn = useServerFn(updateAiSettings);
  const resetFn = useServerFn(resetAiSettings);

  const { data, isLoading } = useQuery({
    queryKey: ["ai-settings"],
    queryFn: () => getFn(),
  });

  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (data?.system_instruction) setDraft(data.system_instruction);
  }, [data?.system_instruction]);

  const saveMut = useMutation({
    mutationFn: () => updateFn({ data: { system_instruction: draft } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-settings"] });
      toast.success("ההגדרות נשמרו");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שמירה נכשלה"),
  });

  const resetMut = useMutation({
    mutationFn: () => resetFn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-settings"] });
      toast.success("שוחזר לברירת מחדל");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שחזור נכשל"),
  });

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isDirty = draft !== data.system_instruction;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 space-y-6">
      <div>
        <EditableSiteText
          as="h1"
          textKey="settings.title"
          defaultValue="הגדרות AI"
          className="text-2xl font-semibold tracking-tight text-foreground block"
        />
        <EditableSiteText
          as="p"
          multiline
          textKey="settings.subtitle"
          defaultValue="נהלו את ה-system instruction וצפו במבנה הפרומפט שנשלח ליצירת מסמכי האפיון."
          className="mt-1 text-sm text-muted-foreground block"
        />
      </div>

      <AppMetadataCard />


      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            System Instruction
          </CardTitle>
          <CardDescription>
            ההוראות שמופנות למודל בעת יצירת מסמך אפיון.
            {data.is_default && " (כרגע בשימוש: ברירת המחדל)"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="sys" className="sr-only">System instruction</Label>
          <Textarea
            id="sys"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={18}
            className="font-mono text-xs leading-relaxed"
            dir="auto"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground" dir="ltr">
              {draft.length} chars
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => resetMut.mutate()}
                disabled={resetMut.isPending || saveMut.isPending}
              >
                <RotateCcw className="mr-1.5 h-4 w-4" />
                שחזר לברירת מחדל
              </Button>
              <Button
                size="sm"
                onClick={() => saveMut.mutate()}
                disabled={!isDirty || draft.trim().length < 10 || saveMut.isPending}
              >
                {saveMut.isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-4 w-4" />
                )}
                שמור
              </Button>
            </div>
          </div>

          {!data.is_default && (
            <details className="rounded-md border border-border bg-muted/30 p-3 text-xs">
              <summary className="cursor-pointer font-medium">הצג ברירת מחדל מקורית</summary>
              <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] text-muted-foreground" dir="auto">
                {data.default_system_instruction}
              </pre>
            </details>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>תבנית הפרומפט הנשלח ל-LLM</CardTitle>
          <CardDescription>
            יצירת המסמך מתבצעת במקביל על שלושה מודלים — התוצאות מוצגות זו לצד זו לבחירה.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <div className="text-xs font-semibold text-muted-foreground">מודלים (מקבילית)</div>
            <ul className="mt-1 space-y-1">
              {COMPARISON_MODELS.map((m) => (
                <li key={m}>
                  <code className="inline-block rounded bg-muted px-2 py-1 text-xs" dir="ltr">
                    {m}
                  </code>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground">System message</div>
            <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 font-mono text-[11px]" dir="auto">
              {draft}
            </pre>
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground">User message</div>
            <pre className="mt-1 rounded-md border border-border bg-muted/30 p-3 font-mono text-[11px]" dir="auto">
              {`{user_prompt}  ← הטקסט שהמשתמש מקליד בדיאלוג "מסמך אפיון חדש"`}
            </pre>
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground">Output schema (structured)</div>
            <ul className="mt-1 list-disc space-y-0.5 rounded-md border border-border bg-muted/30 p-3 pr-6 text-[12px]" dir="auto">
              {OUTPUT_SCHEMA_FIELDS.map((f) => (
                <li key={f}>
                  <code className="text-[11px]">{f}</code>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
