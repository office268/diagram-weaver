import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, RotateCcw, Sparkles, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  getAiSettings,
  updateAiSettings,
  resetAiSettings,
} from "@/lib/ai-settings.functions";

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
import { DocTypeSectionsCard } from "@/components/doc-type-sections-card";
import { useSiteTexts } from "@/lib/site-texts-context";
import { AppBreadcrumb } from "@/components/app-breadcrumb";
import { RestartTourButton } from "@/components/onboarding/restart-tour-button";


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
  const { isAdmin } = useSiteTexts();

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
      <AppBreadcrumb items={[{ label: "פרויקטים", to: "/projects" }, { label: "הגדרות" }]} />

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

      <SettingsSection title="סיור מודרך" description="חזרה על המדריך לשימוש במערכת.">
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
            <div className="text-sm text-muted-foreground">
              הפעלה מחדש של הסיור המקוצר על תכונות המערכת.
            </div>
            <RestartTourButton />
          </CardContent>
        </Card>
      </SettingsSection>

      {isAdmin ? (
        <>
          <SettingsSection title="מטא־דאטה של האפליקציה" description="כותרת, תיאור ותגי שיתוף.">
            <AppMetadataCard />
          </SettingsSection>

          <SettingsSection
            title="סוגי מסמכים וסעיפי ברירת מחדל"
            description="ניהול הסעיפים שיופיעו בכל סוג מסמך חדש."
          >
            <DocTypeSectionsCard />
          </SettingsSection>
        </>
      ) : null}

      <SettingsSection
        title="הוראות מערכת ל-AI"
        description="ה-System Instruction שמופנה למודל בעת יצירת מסמך אפיון."
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <EditableSiteText textKey="settings.sys.title" defaultValue="System Instruction" />
            </CardTitle>
            <CardDescription>
              <EditableSiteText
                textKey="settings.sys.desc"
                defaultValue="ההוראות שמופנות למודל בעת יצירת מסמך אפיון."
              />
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

          </CardContent>
        </Card>
      </SettingsSection>
    </div>
  );
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <section className="rounded-lg border border-border bg-card">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-3 text-right hover:bg-muted/40"
          >
            <ChevronRight
              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
            />
            <div className="flex-1">
              <div className="text-sm font-semibold text-foreground">{title}</div>
              {description ? (
                <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>
              ) : null}
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border p-4">{children}</div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}
