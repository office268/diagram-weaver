import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { FileText, Trash2, Loader2, Sparkles, Check, AlertCircle, RefreshCw, Layers } from "lucide-react";
import {
  listSpecs,
  createSpec,
  deleteSpec,
  deleteSpecGroup,
} from "@/lib/spec.functions";
import {
  SpecOutputSchema,
  extractJson,
  type SpecOutput,
  type SpecReview,
} from "@/lib/spec-output-schema";
import { supabase } from "@/integrations/supabase/client";
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
import { ReviewPanel } from "@/components/review-panel";

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

type Stage =
  | "loading"
  | "reviewing"
  | "revising"
  | "reviewing-revised"
  | "saving";

type ModelOk = {
  status: "success";
  originalSpec: SpecOutput;
  originalSpecId: string;
  originalReview: SpecReview | null;
  revisedSpec: SpecOutput | null;
  revisedSpecId: string | null;
  revisedReview: SpecReview | null;
};

type ModelState =
  | { status: Stage; partialSpec?: SpecOutput; partialReview?: SpecReview | null }
  | ModelOk
  | {
      status: "error";
      error: string;
      originalSpec?: SpecOutput;
      originalReview?: SpecReview | null;
      revisedSpec?: SpecOutput;
      revisedReview?: SpecReview | null;
      canRetry?: boolean;
    };

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
  const deleteGroupFn = useServerFn(deleteSpecGroup);
  
  

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [compareState, setCompareState] = useState<CompareState | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["specs"],
    queryFn: () => listFn(),
  });

  const runModel = useCallback(
    async (model: SpecModel, promptText: string) => {
      const setS = (next: ModelState) =>
        setCompareState((prev) =>
          prev ? { ...prev, [model]: next } : prev,
        );

      setS({ status: "loading" });

      const getToken = async () => {
        const { data: sess } = await supabase.auth.getSession();
        const t = sess.session?.access_token;
        if (!t) throw new Error("נדרשת התחברות מחדש");
        return t;
      };

      const generateOnce = async (
        token: string,
        previousSpec?: SpecOutput,
        reviewerNotes?: string[],
      ): Promise<SpecOutput> => {
        const res = await fetch("/api/generate-spec", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            prompt: promptText,
            model,
            ...(previousSpec ? { previousSpec } : {}),
            ...(reviewerNotes ? { reviewerNotes } : {}),
          }),
        });
        if (!res.ok || !res.body) {
          const errText = (await res.text().catch(() => "")) || `שגיאה ${res.status}`;
          throw new Error(errText);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullText += decoder.decode(value, { stream: true });
        }
        fullText += decoder.decode();

        const errIdx = fullText.indexOf("__STREAM_ERROR__:");
        if (errIdx >= 0) {
          const errMsg = fullText.slice(errIdx + "__STREAM_ERROR__:".length).trim();
          throw new Error(errMsg || "שגיאת זרם מהמודל");
        }
        if (!fullText.trim()) {
          throw new Error("המודל החזיר תשובה ריקה");
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(extractJson(fullText));
        } catch {
          const head = fullText.slice(0, 200).replace(/\s+/g, " ");
          const tail = fullText.slice(-200).replace(/\s+/g, " ");
          throw new Error(
            `המודל לא החזיר JSON תקני (אורך ${fullText.length}). התחלה: ${head} ... סוף: ${tail}`,
          );
        }
        return SpecOutputSchema.parse(parsed);
      };

      const reviewOnce = async (
        token: string,
        spec: SpecOutput,
      ): Promise<SpecReview | null> => {
        try {
          const revRes = await fetch("/api/review-spec", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ prompt: promptText, spec }),
          });
          if (!revRes.ok) {
            const t = await revRes.text().catch(() => "");
            throw new Error(t || `שגיאה ${revRes.status}`);
          }
          const json = await revRes.json();
          if (json?.score == null) return null;
          return {
            score: Number(json.score),
            notes: Array.isArray(json.notes) ? json.notes.map(String) : [],
          };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          toast.warning(`סוכן הביקורת נכשל (${model}): ${msg}`);
          return null;
        }
      };

      const saveOne = async (
        spec: SpecOutput,
        review: SpecReview | null,
        suffix: string,
      ): Promise<string> => {
        const { spec: row } = await createFn({
          data: {
            title: `${spec.title} — ${model} — ${suffix}`,
            prompt: promptText,
            content: spec,
            reviewScore: review?.score ?? null,
            reviewNotes: review?.notes ?? [],
          },
        });
        return row.id;
      };

      try {
        const token = await getToken();

        // Stage 1: original generation
        const originalSpec = await generateOnce(token);

        // Stage 2: first review
        setS({ status: "reviewing", partialSpec: originalSpec });
        const originalReview = await reviewOnce(token, originalSpec);

        // Decide whether to revise
        const shouldRevise =
          originalReview != null &&
          originalReview.notes.length > 0 &&
          originalReview.score < 10;

        let revisedSpec: SpecOutput | null = null;
        let revisedReview: SpecReview | null = null;

        if (shouldRevise) {
          // Stage 3: revised generation
          setS({
            status: "revising",
            partialSpec: originalSpec,
            partialReview: originalReview,
          });
          try {
            revisedSpec = await generateOnce(
              token,
              originalSpec,
              originalReview!.notes,
            );

            // Stage 4: review the revised spec
            setS({
              status: "reviewing-revised",
              partialSpec: revisedSpec,
              partialReview: originalReview,
            });
            revisedReview = await reviewOnce(token, revisedSpec);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            toast.warning(`יצירת הגרסה המתוקנת נכשלה (${model}): ${msg}`);
            revisedSpec = null;
            revisedReview = null;
          }
        }

        // Stage 5: save
        setS({
          status: "saving",
          partialSpec: revisedSpec ?? originalSpec,
          partialReview: revisedReview ?? originalReview,
        });
        try {
          const originalSpecId = await saveOne(
            originalSpec,
            originalReview,
            revisedSpec ? "מקור" : "מסמך",
          );
          let revisedSpecId: string | null = null;
          if (revisedSpec) {
            revisedSpecId = await saveOne(revisedSpec, revisedReview, "מתוקן");
          }
          setS({
            status: "success",
            originalSpec,
            originalSpecId,
            originalReview,
            revisedSpec,
            revisedSpecId,
            revisedReview,
          });
          qc.invalidateQueries({ queryKey: ["specs"] });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "שמירה נכשלה";
          setS({
            status: "error",
            error: `המסמך נוצר אך השמירה נכשלה: ${msg}`,
            originalSpec,
            originalReview,
            revisedSpec: revisedSpec ?? undefined,
            revisedReview: revisedReview ?? undefined,
            canRetry: true,
          });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "יצירה נכשלה";
        setS({ status: "error", error: msg, canRetry: true });
      }
    },
    [createFn, qc],
  );

  const retryModel = useCallback(
    (model: SpecModel) => {
      if (!compareState) return;
      void runModel(model, prompt);
    },
    [compareState, prompt, runModel],
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
    ? Object.values(compareState).some((s) =>
        ["loading", "reviewing", "revising", "reviewing-revised", "saving"].includes(
          s.status,
        ),
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
        anyBusy={anyBusy}
        onClose={() => setCompareState(null)}
        onPick={handlePick}
        onRetry={retryModel}
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
  anyBusy,
  onClose,
  onPick,
  onRetry,
}: {
  state: CompareState | null;
  anyBusy: boolean;
  onClose: () => void;
  onPick: (specId: string) => void;
  onRetry: (model: SpecModel) => void;
}) {
  if (!state) return null;
  const models = COMPARISON_MODELS;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            השוואת תוצאות מ-3 מודלים
            {anyBusy ? (
              <Loader2 className="inline-block mr-2 h-4 w-4 animate-spin text-muted-foreground" />
            ) : null}
          </DialogTitle>
          <DialogDescription>
            כל מסמך שמצליח נשמר אוטומטית ברשימה. כפתור "בחר" רק פותח את המסמך לעריכה.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={models[0]} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            {models.map((m) => {
              const s = state[m];
              return (
                <TabsTrigger key={m} value={m} className="text-xs" dir="ltr">
                  {m.split("/")[1]}
                  {s.status === "error" ? (
                    <AlertCircle className="ml-1 h-3 w-3 text-destructive" />
                  ) : s.status === "success" ? (
                    <Check className="ml-1 h-3 w-3 text-primary" />
                  ) : (
                    <Loader2 className="ml-1 h-3 w-3 animate-spin text-muted-foreground" />
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
                <ModelTabBody state={s} onRetry={() => onRetry(m)} />
              </TabsContent>
            );
          })}
        </Tabs>

        <DialogFooter className="border-t border-border pt-4 flex-wrap gap-2">
          <Button variant="ghost" onClick={onClose}>
            סגור
          </Button>
          {models.map((m) => {
            const s = state[m];
            if (s.status !== "success") return null;
            return (
              <div key={m} className="flex gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onPick(s.originalSpecId)}
                  dir="ltr"
                >
                  <Check className="mr-1.5 h-4 w-4" />
                  {s.revisedSpecId ? "מקור" : "פתח"}: {m.split("/")[1]}
                </Button>
                {s.revisedSpecId ? (
                  <Button
                    size="sm"
                    onClick={() => onPick(s.revisedSpecId!)}
                    dir="ltr"
                  >
                    <Check className="mr-1.5 h-4 w-4" />
                    מתוקן: {m.split("/")[1]}
                  </Button>
                ) : null}
              </div>
            );
          })}
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}

const STAGE_LABEL: Record<Stage, string> = {
  loading: "המודל עובד… עשוי לקחת עד דקה.",
  reviewing: "סוכן הביקורת בודק את האפיון…",
  revising: "מריץ את סוכן הניתוח שוב עם הערות המבקר…",
  "reviewing-revised": "סוכן הביקורת בודק את הגרסה המתוקנת…",
  saving: "שומר את המסמכים…",
};

function ModelTabBody({
  state,
  onRetry,
}: {
  state: ModelState;
  onRetry: () => void;
}) {
  if (state.status === "error") {
    return (
      <div className="space-y-3">
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <div className="font-medium">המודל נכשל</div>
          <div className="mt-1 text-xs">{state.error}</div>
        </div>
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RefreshCw className="mr-1.5 h-4 w-4" />
          נסה שוב
        </Button>
        {state.revisedSpec ? (
          <ResultPreview spec={state.revisedSpec} review={state.revisedReview ?? null} />
        ) : state.originalSpec ? (
          <ResultPreview spec={state.originalSpec} review={state.originalReview ?? null} />
        ) : null}
      </div>
    );
  }

  if (state.status === "success") {
    if (!state.revisedSpec) {
      return <ResultPreview spec={state.originalSpec} review={state.originalReview} />;
    }
    return (
      <Tabs defaultValue="revised" className="space-y-3">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="revised">מתוקן</TabsTrigger>
          <TabsTrigger value="original">מקור</TabsTrigger>
        </TabsList>
        <TabsContent value="revised">
          <ResultPreview spec={state.revisedSpec} review={state.revisedReview} />
        </TabsContent>
        <TabsContent value="original">
          <ResultPreview spec={state.originalSpec} review={state.originalReview} />
        </TabsContent>
      </Tabs>
    );
  }

  // In-flight stage
  const label = STAGE_LABEL[state.status];
  const partial = state.partialSpec;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {label}
      </div>
      {partial ? (
        <ResultPreview spec={partial} review={state.partialReview ?? null} />
      ) : (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}


function ResultPreview({
  spec,
  review,
}: {
  spec: SpecOutput;
  review: SpecReview | null;
}) {
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
      {review ? <ReviewPanel review={review} /> : null}
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


