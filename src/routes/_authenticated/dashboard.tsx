import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { FileText, Trash2, Loader2, Sparkles, Check, AlertCircle, RefreshCw } from "lucide-react";
import {
  listSpecs,
  createSpec,
  deleteSpec,
} from "@/lib/spec.functions";
import { generateSpecFromModel } from "@/lib/ai-spec.functions";
import type { SpecOutput } from "@/lib/ai-spec.functions";
import { COMPARISON_MODELS, type SpecModel } from "@/lib/ai-spec-defaults";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "המסמכים שלי — סוכן ניתוח מערכות" },
      {
        name: "description",
        content: "כל מסמכי האפיון על שלך במקום אחד — צרו חדש מתוך תיאור חופשי של המערכת.",
      },
      { property: "og:title", content: "המסמכים שלי — סוכן ניתוח מערכות" },
      { property: "og:url", content: "/dashboard" },
    ],
  }),
  component: DashboardPage,
});

type ModelState =
  | { status: "loading" }
  | { status: "saving"; spec: SpecOutput }
  | { status: "success"; spec: SpecOutput; specId: string }
  | { status: "error"; error: string; spec?: SpecOutput; canRetrySaveOnly?: boolean };

type CompareState = Record<SpecModel, ModelState>;

function initialCompareState(): CompareState {
  return Object.fromEntries(
    COMPARISON_MODELS.map((m) => [m, { status: "loading" } as ModelState]),
  ) as CompareState;
}

function DashboardPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listFn = useServerFn(listSpecs);
  const createFn = useServerFn(createSpec);
  const deleteFn = useServerFn(deleteSpec);
  const genFn = useServerFn(generateSpecFromModel);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [compareState, setCompareState] = useState<CompareState | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["specs"],
    queryFn: () => listFn(),
  });

  const saveSpec = useCallback(
    async (model: SpecModel, spec: SpecOutput, promptText: string) => {
      setCompareState((prev) =>
        prev ? { ...prev, [model]: { status: "saving", spec } } : prev,
      );
      try {
        const { spec: row } = await createFn({
          data: {
            title: `${spec.title} — ${model}`,
            prompt: promptText,
            content: spec,
          },
        });
        setCompareState((prev) =>
          prev
            ? { ...prev, [model]: { status: "success", spec, specId: row.id } }
            : prev,
        );
        qc.invalidateQueries({ queryKey: ["specs"] });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "שמירה נכשלה";
        setCompareState((prev) =>
          prev
            ? {
                ...prev,
                [model]: {
                  status: "error",
                  error: `המסמך נוצר אך השמירה נכשלה: ${msg}`,
                  spec,
                  canRetrySaveOnly: true,
                },
              }
            : prev,
        );
      }
    },
    [createFn, qc],
  );

  const runModel = useCallback(
    async (model: SpecModel, promptText: string) => {
      setCompareState((prev) => ({
        ...(prev ?? initialCompareState()),
        [model]: { status: "loading" },
      }));
      try {
        const { spec } = await genFn({ data: { prompt: promptText, model } });
        await saveSpec(model, spec, promptText);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "יצירה נכשלה";
        setCompareState((prev) =>
          prev ? { ...prev, [model]: { status: "error", error: msg } } : prev,
        );
      }
    },
    [genFn, saveSpec],
  );

  const retryModel = useCallback(
    (model: SpecModel) => {
      if (!compareState) return;
      const s = compareState[model];
      if (s.status === "error" && s.canRetrySaveOnly && s.spec) {
        void saveSpec(model, s.spec, prompt);
      } else {
        void runModel(model, prompt);
      }
    },
    [compareState, prompt, runModel, saveSpec],
  );

  const startCompare = useCallback(() => {
    const p = prompt.trim();
    if (p.length < 5) return;
    setNewOpen(false);
    setCompareState(initialCompareState());
    COMPARISON_MODELS.forEach((m) => {
      void runModel(m, p);
    });
  }, [prompt, runModel]);

  const handlePick = useCallback(
    (specId: string) => {
      setCompareState(null);
      setPrompt("");
      navigate({ to: "/editor/$id", params: { id: specId } });
    },
    [navigate],
  );

  const anyBusy = compareState
    ? Object.values(compareState).some(
        (s) => s.status === "loading" || s.status === "saving",
      )
    : false;


  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["specs"] });
      toast.success("המסמך נמחק");
      setDeleteId(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "מחיקה נכשלה"),
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            מסמכי האפיון שלי
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            תארו מערכת בחופשי — ה-3 מודלים יבנו מסמך והשוו ביניהם.
          </p>
        </div>
        <Button onClick={() => setNewOpen(true)} className="w-full sm:w-auto">
          <Sparkles className="mr-2 h-4 w-4" />
          מסמך אפיון חדש
        </Button>
      </div>

      <div className="mt-8">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {(error as Error).message}
          </div>
        ) : !data?.specs.length ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
            <h3 className="mt-4 font-medium text-foreground">עדיין אין מסמכים</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              לחצו על "מסמך אפיון חדש" כדי להתחיל.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.specs.map((d) => (
              <li
                key={d.id}
                className="group relative flex flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <Link to="/editor/$id" params={{ id: d.id }} className="flex-1">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="truncate font-medium text-foreground">
                      {d.title}
                    </span>
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">
                    עודכן ב-{new Date(d.updated_at).toLocaleDateString("he-IL")}
                  </div>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-2 h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => {
                    e.preventDefault();
                    setDeleteId(d.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              מסמך אפיון חדש
            </DialogTitle>
            <DialogDescription>
              תארו את המערכת — נריץ במקביל על 3 מודלים ותוכלו להשוות לפני בחירה.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="spec-prompt">תיאור המערכת</Label>
            <Textarea
              id="spec-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="למשל: מערכת לניהול הזמנות במסעדה..."
              rows={7}
              maxLength={5000}
              autoFocus
            />
            <div className="text-left text-xs text-muted-foreground" dir="ltr">
              {prompt.length} / 5000
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewOpen(false)}>
              ביטול
            </Button>
            <Button onClick={startCompare} disabled={prompt.trim().length < 5}>
              <Sparkles className="mr-2 h-4 w-4" />
              צור והשווה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ComparisonDialog
        state={compareState}
        anyLoading={anyLoading}
        onClose={() => !pickMut.isPending && setCompareState(null)}
        onPick={(model, spec) => pickMut.mutate({ model, spec })}
        onRetry={(model) => void runModel(model, prompt)}
        savingModel={savingModel}
      />


      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>למחוק את המסמך?</AlertDialogTitle>
            <AlertDialogDescription>
              לא ניתן לבטל פעולה זו.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMut.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ComparisonDialog({
  state,
  anyLoading,
  onClose,
  onPick,
  onRetry,
  savingModel,
}: {
  state: CompareState | null;
  anyLoading: boolean;
  onClose: () => void;
  onPick: (model: SpecModel, spec: SpecOutput) => void;
  onRetry: (model: SpecModel) => void;
  savingModel: SpecModel | null;
}) {
  if (!state) return null;
  const models = COMPARISON_MODELS;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            השוואת תוצאות מ-3 מודלים
            {anyLoading ? (
              <Loader2 className="inline-block mr-2 h-4 w-4 animate-spin text-muted-foreground" />
            ) : null}
          </DialogTitle>
          <DialogDescription>
            תוצאות מופיעות ברגע שכל מודל מסיים. ניתן לבחור גם בזמן שהאחרים עוד רצים.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={models[0]} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            {models.map((m) => {
              const s = state[m];
              return (
                <TabsTrigger key={m} value={m} className="text-xs" dir="ltr">
                  {m.split("/")[1]}
                  {s.status === "loading" ? (
                    <Loader2 className="ml-1 h-3 w-3 animate-spin text-muted-foreground" />
                  ) : s.status === "error" ? (
                    <AlertCircle className="ml-1 h-3 w-3 text-destructive" />
                  ) : (
                    <Check className="ml-1 h-3 w-3 text-primary" />
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {models.map((m) => {
            const s = state[m];
            return (
              <TabsContent
                key={m}
                value={m}
                className="flex-1 overflow-auto mt-3 rounded-md border border-border p-4"
              >
                {s.status === "loading" ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <div className="mt-3 text-sm">המודל עובד… עשוי לקחת עד דקה.</div>
                  </div>
                ) : s.status === "error" ? (
                  <div className="space-y-3">
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                      <div className="font-medium">המודל נכשל</div>
                      <div className="mt-1 text-xs">{s.error}</div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => onRetry(m)}>
                      <RefreshCw className="mr-1.5 h-4 w-4" />
                      נסה שוב
                    </Button>
                  </div>
                ) : (
                  <ResultPreview spec={s.spec} />
                )}
              </TabsContent>
            );
          })}
        </Tabs>

        <DialogFooter className="border-t border-border pt-4 flex-wrap gap-2">
          <Button variant="ghost" onClick={onClose} disabled={!!savingModel}>
            סגור
          </Button>
          {models.map((m) => {
            const s = state[m];
            if (s.status !== "success") return null;
            return (
              <Button
                key={m}
                size="sm"
                variant={savingModel === m ? "default" : "outline"}
                onClick={() => onPick(m, s.spec)}
                disabled={!!savingModel}
                dir="ltr"
              >
                {savingModel === m ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-1.5 h-4 w-4" />
                )}
                בחר: {m.split("/")[1]}
              </Button>
            );
          })}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function ResultPreview({ spec }: { spec: SpecOutput }) {
  const stats = [
    { label: "מטרות", n: spec.goals.length },
    { label: "Personas", n: spec.personas.length },
    { label: "דרישות פונק'", n: spec.functional_requirements.length },
    { label: "דרישות לא-פונק'", n: spec.non_functional_requirements.length },
    { label: "הנחות", n: spec.assumptions.length },
    { label: "תרחישים", n: spec.use_cases.length },
    { label: "סיכונים", n: spec.risks.length },
  ];
  return (
    <div className="space-y-4 text-sm">
      <div>
        <h3 className="font-semibold text-foreground">{spec.title}</h3>
        <p className="mt-1 text-muted-foreground whitespace-pre-wrap">{spec.overview}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-md border border-border bg-muted/30 p-2 text-center">
            <div className="text-lg font-semibold text-foreground">{s.n}</div>
            <div className="text-[11px] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>
      <details className="rounded-md border border-border bg-muted/30 p-3 text-xs">
        <summary className="cursor-pointer font-medium">הצג מסמך מלא (JSON)</summary>
        <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap font-mono text-[11px]" dir="ltr">
          {JSON.stringify(spec, null, 2)}
        </pre>
      </details>
    </div>
  );
}
