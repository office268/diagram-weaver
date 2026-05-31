import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { FileText, Trash2, Loader2, Sparkles, Layers, ArrowRight } from "lucide-react";
import {
  createSpec,
  deleteSpec,
  deleteSpecGroup,
  updateSpec,
  updateGroupPrompt,
} from "@/lib/spec.functions";
import { getProject } from "@/lib/project.functions";

import {
  SpecOutputSchema,
  extractJson,
  type SpecOutput,
  type SpecReview,
  type ReviewNote,
  normalizeReviewNotes,
} from "@/lib/spec-output-schema";
import { supabase } from "@/integrations/supabase/client";
import type { SpecModel } from "@/lib/ai-spec-defaults";
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
import { ReviewSuggestionsPanel } from "@/components/review-suggestions-panel";

import { DOC_TYPES, DOC_TYPE_KEYS, getDocType, type DocTypeKey } from "@/lib/doc-types";
import { listDocTypeSettings, effectiveDocTypeConfig } from "@/lib/doc-type-settings.functions";


export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  head: () => ({
    meta: [
      { title: "פרויקט — סוכן ניתוח מערכות" },
      {
        name: "description",
        content: "ניהול סוגי מסמכים וגרסאות בתוך פרויקט בודד.",
      },
    ],
  }),
  component: ProjectPage,

});

/**
 * One generated version inside an iterative build session.
 * Each iteration is saved to the DB and shows up in the project history.
 */
type Iteration = {
  version: number;
  specId: string;
  spec: SpecOutput;
  review: SpecReview | null;
  /** Note ids the user picked to feed into the NEXT iteration. */
  selectedNoteIds: Set<string>;
};

type BuilderPhase =
  | "generating"
  | "reviewing"
  | "ready"
  | "error";

type BuilderState = {
  groupId: string;
  prompt: string;
  docType: DocTypeKey;
  model: SpecModel;
  iterations: Iteration[];
  phase: BuilderPhase;
  error?: string;
};

function ProjectPage() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getProjectFn = useServerFn(getProject);
  const createFn = useServerFn(createSpec);
  const deleteFn = useServerFn(deleteSpec);
  const deleteGroupFn = useServerFn(deleteSpecGroup);
  const listDtsFn = useServerFn(listDocTypeSettings);

  const { data: dtsData } = useQuery({
    queryKey: ["doc-type-settings"],
    queryFn: () => listDtsFn(),
  });

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [docType, setDocType] = useState<DocTypeKey>("spec_overview");
  const [prompt, setPrompt] = useState("");
  const [builder, setBuilder] = useState<BuilderState | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProjectFn({ data: { id: projectId } }),
  });

  /** Low-level: one streamed generation call. */
  const generateOnce = useCallback(
    async (
      token: string,
      params: {
        promptText: string;
        model: SpecModel;
        docTypeKey: DocTypeKey;
        previousSpec?: SpecOutput;
        reviewerNotes?: string[];
      },
    ): Promise<SpecOutput> => {
      const res = await fetch("/api/generate-spec", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt: params.promptText,
          model: params.model,
          docType: params.docTypeKey,
          ...(params.previousSpec ? { previousSpec: params.previousSpec } : {}),
          ...(params.reviewerNotes ? { reviewerNotes: params.reviewerNotes } : {}),
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
        const errMsg = fullText
          .slice(errIdx + "__STREAM_ERROR__:".length)
          .trim();
        throw new Error(errMsg || "שגיאת זרם מהמודל");
      }
      if (!fullText.trim()) throw new Error("המודל החזיר תשובה ריקה");
      let parsed: unknown;
      try {
        parsed = JSON.parse(extractJson(fullText));
      } catch {
        throw new Error(`המודל לא החזיר JSON תקני (אורך ${fullText.length})`);
      }
      return SpecOutputSchema.parse(parsed);
    },
    [],
  );

  /** Low-level: one review call. Returns null on failure (toast-warned). */
  const reviewOnce = useCallback(
    async (
      token: string,
      promptText: string,
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
          notes: normalizeReviewNotes(json.notes),
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.warning(`סוכן הביקורת נכשל: ${msg}`);
        return null;
      }
    },
    [],
  );

  const saveIteration = useCallback(
    async (params: {
      groupId: string;
      promptText: string;
      docTypeKey: DocTypeKey;
      model: SpecModel;
      version: number;
      spec: SpecOutput;
      review: SpecReview | null;
    }): Promise<string> => {
      const docTypeDef = getDocType(params.docTypeKey);
      const effective = effectiveDocTypeConfig(
        params.docTypeKey,
        dtsData?.overrides[params.docTypeKey] ?? null,
      );
      const suffix = params.version === 1 ? "v1" : `v${params.version}`;
      const variant: "original" | "revised" =
        params.version === 1 ? "original" : "revised";
      const { spec: row } = await createFn({
        data: {
          title: `${params.spec.title} — ${docTypeDef.label} — ${suffix}`,
          prompt: params.promptText,
          content: params.spec,
          reviewScore: params.review?.score ?? null,
          reviewNotes: params.review?.notes ?? [],
          groupId: params.groupId,
          model: params.model,
          variant,
          docType: params.docTypeKey,
          sectionOrder: effective.sectionOrder,
          sectionTitles: effective.sectionTitles,
          projectId,
        },
      });
      return row.id;
    },
    [createFn, dtsData, projectId],
  );

  const getToken = useCallback(async () => {
    const { data: sess } = await supabase.auth.getSession();
    const t = sess.session?.access_token;
    if (!t) throw new Error("נדרשת התחברות מחדש");
    return t;
  }, []);

  /** Start a new iterative build session (v1). */
  const startBuilder = useCallback(async () => {
    const p = prompt.trim();
    if (p.length < 5) return;
    setNewOpen(false);
    const groupId = crypto.randomUUID();
    const model: SpecModel = "";
    const initialState: BuilderState = {
      groupId,
      prompt: p,
      docType,
      model,
      iterations: [],
      phase: "generating",
    };
    setBuilder(initialState);

    try {
      const token = await getToken();
      const spec = await generateOnce(token, {
        promptText: p,
        model,
        docTypeKey: docType,
      });
      setBuilder((prev) =>
        prev ? { ...prev, phase: "reviewing" } : prev,
      );
      const review = await reviewOnce(token, p, spec);
      const specId = await saveIteration({
        groupId,
        promptText: p,
        docTypeKey: docType,
        model,
        version: 1,
        spec,
        review,
      });
      const iteration: Iteration = {
        version: 1,
        specId,
        spec,
        review,
        selectedNoteIds: new Set(),
      };
      setBuilder((prev) =>
        prev ? { ...prev, iterations: [iteration], phase: "ready" } : prev,
      );
      qc.invalidateQueries({ queryKey: ["project", projectId] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "יצירה נכשלה";
      setBuilder((prev) =>
        prev ? { ...prev, phase: "error", error: msg } : prev,
      );
    }
  }, [
    prompt,
    docType,
    generateOnce,
    reviewOnce,
    saveIteration,
    getToken,
    qc,
    projectId,
  ]);

  /** Generate the next iteration using user-selected suggestions. */
  const improveBuilder = useCallback(async () => {
    if (!builder || builder.phase !== "ready") return;
    const last = builder.iterations[builder.iterations.length - 1];
    if (!last || !last.review) return;
    const selectedNotes: ReviewNote[] = last.review.notes.filter((n) =>
      last.selectedNoteIds.has(n.id),
    );
    if (selectedNotes.length === 0) return;
    const reviewerNotes = selectedNotes.map((n) => n.text);
    const nextVersion = last.version + 1;

    setBuilder((prev) => (prev ? { ...prev, phase: "generating" } : prev));
    try {
      const token = await getToken();
      const spec = await generateOnce(token, {
        promptText: builder.prompt,
        model: builder.model,
        docTypeKey: builder.docType,
        previousSpec: last.spec,
        reviewerNotes,
      });
      setBuilder((prev) => (prev ? { ...prev, phase: "reviewing" } : prev));
      const review = await reviewOnce(token, builder.prompt, spec);
      const specId = await saveIteration({
        groupId: builder.groupId,
        promptText: builder.prompt,
        docTypeKey: builder.docType,
        model: builder.model,
        version: nextVersion,
        spec,
        review,
      });
      const nextIteration: Iteration = {
        version: nextVersion,
        specId,
        spec,
        review,
        selectedNoteIds: new Set(),
      };
      setBuilder((prev) =>
        prev
          ? {
              ...prev,
              iterations: [...prev.iterations, nextIteration],
              phase: "ready",
            }
          : prev,
      );
      qc.invalidateQueries({ queryKey: ["project", projectId] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "יצירה נכשלה";
      setBuilder((prev) =>
        prev ? { ...prev, phase: "error", error: msg } : prev,
      );
    }
  }, [
    builder,
    generateOnce,
    reviewOnce,
    saveIteration,
    getToken,
    qc,
    projectId,
  ]);

  const toggleNote = useCallback((version: number, noteId: string) => {
    setBuilder((prev) => {
      if (!prev) return prev;
      const iterations = prev.iterations.map((it) => {
        if (it.version !== version) return it;
        const next = new Set(it.selectedNoteIds);
        if (next.has(noteId)) next.delete(noteId);
        else next.add(noteId);
        return { ...it, selectedNoteIds: next };
      });
      return { ...prev, iterations };
    });
  }, []);

  const setNoteSelection = useCallback(
    (version: number, ids: Set<string>) => {
      setBuilder((prev) => {
        if (!prev) return prev;
        const iterations = prev.iterations.map((it) =>
          it.version === version ? { ...it, selectedNoteIds: ids } : it,
        );
        return { ...prev, iterations };
      });
    },
    [],
  );

  const finishBuilder = useCallback(
    (specId?: string) => {
      const target =
        specId ??
        builder?.iterations[builder.iterations.length - 1]?.specId ??
        null;
      setBuilder(null);
      setPrompt("");
      if (target) navigate({ to: "/editor/$id", params: { id: target } });
    },
    [builder, navigate],
  );

  const retryBuilder = useCallback(() => {
    if (!builder) return;
    // If the failure happened mid-improvement, just resume from selected notes.
    if (builder.iterations.length > 0) {
      void improveBuilder();
    } else {
      void startBuilder();
    }
  }, [builder, improveBuilder, startBuilder]);






  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("המסמך נמחק");
      setDeleteId(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "מחיקה נכשלה"),
  });

  const deleteGroupMut = useMutation({
    mutationFn: (groupId: string) => deleteGroupFn({ data: { groupId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("הקבוצה נמחקה");
      setDeleteGroupId(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "מחיקה נכשלה"),
  });

  type SpecRow = NonNullable<typeof data>["specs"][number];
  type Group = { key: string; groupId: string | null; items: SpecRow[] };
  const groupsByType = useMemo(() => {
    const byType: Record<string, Group[]> = {};
    if (!data?.specs.length) return byType;
    const map = new Map<string, SpecRow[]>();
    const order: string[] = [];
    for (const s of data.specs) {
      const k = s.group_id ?? `__solo__:${s.id}`;
      if (!map.has(k)) {
        map.set(k, []);
        order.push(k);
      }
      map.get(k)!.push(s);
    }
    for (const k of order) {
      const items = map.get(k)!;
      items.sort((a, b) => {
        const rank = (v: string | null) =>
          v === "original" ? 0 : v === "single" ? 1 : v === "revised" ? 2 : 3;
        return rank(a.variant) - rank(b.variant);
      });
      const t = (items[0] as SpecRow & { doc_type?: string }).doc_type ?? "spec_overview";
      if (!byType[t]) byType[t] = [];
      byType[t].push({ key: k, groupId: items[0].group_id, items });
    }
    return byType;
  }, [data]);



  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <Link
        to="/projects"
        className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="h-3.5 w-3.5" />
        חזרה לרשימת הפרויקטים
      </Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {data?.project?.name ?? "פרויקט"}
          </h1>
          {data?.project?.description ? (
            <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
              {data.project.description}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              בחרו סוג מסמך ליצור — תחת הפרויקט יישמרו כל הסוגים והגרסאות.
            </p>
          )}
        </div>
        <Button onClick={() => setTypePickerOpen(true)} className="w-full sm:w-auto">
          <Sparkles className="mr-2 h-4 w-4" />
          מסמך חדש
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
            <h3 className="mt-4 font-medium text-foreground">עדיין אין מסמכים בפרויקט</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              לחצו על "מסמך חדש" ובחרו את סוג המסמך הרצוי.
            </p>
          </div>

        ) : (
          <div className="space-y-8">
            {DOC_TYPE_KEYS.map((typeKey) => {
              const typeGroups = groupsByType[typeKey];
              if (!typeGroups || typeGroups.length === 0) return null;
              const def = DOC_TYPES[typeKey];
              return (
                <section key={typeKey}>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-foreground">{def.label}</h2>
                      <span className="text-xs text-muted-foreground">
                        ({typeGroups.length})
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setDocType(typeKey);
                        setNewOpen(true);
                      }}
                    >
                      <Sparkles className="mr-1 h-3.5 w-3.5" />
                      צור מסוג זה
                    </Button>
                  </div>
                  <ul className="space-y-4">
                    {typeGroups.map((g) => {
                      const isGroup = g.items.length > 1;
                      const head = g.items[0];
                      const topic = (head.prompt?.trim() || head.title).slice(0, 140);
                      const updated = g.items
                        .map((i) => +new Date(i.updated_at))
                        .reduce((a, b) => Math.max(a, b), 0);

                      if (!isGroup) {
                        const d = head;
                        return (
                          <li
                            key={g.key}
                            className="group relative flex flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
                          >
                            <Link to="/editor/$id" params={{ id: d.id }} className="flex-1">
                              <div className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
                                <FileText className="h-4 w-4 text-primary" />
                                <EditableDocTitle id={d.id} value={d.title} className="truncate font-medium text-foreground" />
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
                        );
                      }

                      return (
                        <li
                          key={g.key}
                          className="relative rounded-2xl border-2 border-primary/20 bg-muted/30 p-4"
                        >
                          <div className="mb-3 flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 min-w-0">
                              <Layers className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                              <div className="min-w-0">
                                {g.groupId ? (
                                  <EditableGroupPrompt
                                    groupId={g.groupId}
                                    value={topic}
                                    className="font-semibold text-foreground line-clamp-2 block"
                                  />
                                ) : (
                                  <h3 className="font-semibold text-foreground line-clamp-2">
                                    {topic}
                                  </h3>
                                )}
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {g.items.length} גרסאות · עודכן ב-
                                  {new Date(updated).toLocaleDateString("he-IL")}
                                </p>
                              </div>
                            </div>
                            {g.groupId && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={() => setDeleteGroupId(g.groupId!)}
                                title="מחק את כל הקבוצה"
                              >
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            )}
                          </div>

                          <ul className="relative space-y-2 pr-5">
                            <span
                              aria-hidden
                              className="pointer-events-none absolute top-2 bottom-2 right-2 border-r-2 border-dashed border-primary/40"
                            />
                            {g.items.map((d) => {
                              const variantLabel =
                                d.variant === "revised"
                                  ? "מתוקן"
                                  : d.variant === "original"
                                    ? "מקור"
                                    : null;
                              return (
                                <li key={d.id} className="group/item relative">
                                  <span
                                    aria-hidden
                                    className="pointer-events-none absolute top-1/2 -right-3 h-0 w-3 border-t-2 border-dashed border-primary/40"
                                  />
                                  <Link
                                    to="/editor/$id"
                                    params={{ id: d.id }}
                                    className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 transition-colors hover:border-primary/40"
                                  >
                                    <div className="flex min-w-0 items-center gap-2" onClick={(e) => e.preventDefault()}>
                                      <FileText className="h-4 w-4 shrink-0 text-primary" />
                                      <EditableDocTitle id={d.id} value={d.title} className="truncate text-sm text-foreground" />
                                      {variantLabel && (
                                        <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
                                          {variantLabel}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                      {typeof d.review_score === "number" && (
                                        <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                                          ציון {d.review_score}/10
                                        </span>
                                      )}
                                      <Button
                                        asChild={false}
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 opacity-0 transition-opacity group-hover/item:opacity-100"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setDeleteId(d.id);
                                        }}
                                      >
                                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                                      </Button>
                                    </div>
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>



      <Dialog open={typePickerOpen} onOpenChange={setTypePickerOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              בחר סוג מסמך ליצירה
            </DialogTitle>
            <DialogDescription>
              כל סוג מסמך מייצר סעיפים מותאמים והנחיה ייעודית למודל ה-AI.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {DOC_TYPE_KEYS.map((k) => {
              const t = DOC_TYPES[k];
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setDocType(k);
                    setTypePickerOpen(false);
                    setNewOpen(true);
                  }}
                  className="group rounded-lg border border-border bg-card p-4 text-right transition-colors hover:border-primary hover:bg-accent/30 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <div className="flex items-start gap-2">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="space-y-1">
                      <div className="font-medium text-foreground">{t.label}</div>
                      <div className="text-xs text-muted-foreground">{t.description}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setTypePickerOpen(false)}>
              ביטול
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {DOC_TYPES[docType].label} — תיאור
            </DialogTitle>
            <DialogDescription>
              {DOC_TYPES[docType].description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="spec-prompt">תיאור / פרומפט</Label>
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
            <Button
              variant="ghost"
              onClick={() => {
                setNewOpen(false);
                setTypePickerOpen(true);
              }}
            >
              חזרה
            </Button>
            <Button onClick={startBuilder} disabled={prompt.trim().length < 5}>
              <Sparkles className="mr-2 h-4 w-4" />
              צור מסמך
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <IterativeBuilderDialog
        state={builder}
        onClose={() => setBuilder(null)}
        onToggleNote={toggleNote}
        onSetSelection={setNoteSelection}
        onImprove={improveBuilder}
        onFinish={finishBuilder}
        onRetry={retryBuilder}
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

      <AlertDialog open={!!deleteGroupId} onOpenChange={(o) => !o && setDeleteGroupId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>למחוק את כל הקבוצה?</AlertDialogTitle>
            <AlertDialogDescription>
              כל הגרסאות שנוצרו באותה הרצת אפיון יימחקו. לא ניתן לבטל פעולה זו.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteGroupId && deleteGroupMut.mutate(deleteGroupId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              מחק קבוצה
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function IterativeBuilderDialog({
  state,
  onClose,
  onToggleNote,
  onSetSelection,
  onImprove,
  onFinish,
  onRetry,
}: {
  state: BuilderState | null;
  onClose: () => void;
  onToggleNote: (version: number, noteId: string) => void;
  onSetSelection: (version: number, ids: Set<string>) => void;
  onImprove: () => void;
  onFinish: (specId?: string) => void;
  onRetry: () => void;
}) {
  if (!state) return null;
  const busy = state.phase === "generating" || state.phase === "reviewing";
  const last = state.iterations[state.iterations.length - 1] ?? null;
  const totalVersions = state.iterations.length;

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o && !busy) onClose();
      }}
    >
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            יצירה איטרטיבית של מסמך
            {totalVersions > 0 ? (
              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                גרסה {totalVersions}
              </span>
            ) : null}
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : null}
          </DialogTitle>
          <DialogDescription>
            כל גרסה נשמרת בפרויקט. סמנו את ההצעות שתרצו להטמיע ולחצו "צור גרסה משופרת".
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto pr-1">
          {state.phase === "generating" ? (
            <PhaseBanner
              text={
                totalVersions === 0
                  ? "סוכן היצירה כותב את המסמך…"
                  : `סוכן היצירה כותב גרסה ${totalVersions + 1}…`
              }
            />
          ) : state.phase === "reviewing" ? (
            <PhaseBanner text="סוכן הביקורת בודק את המסמך…" />
          ) : null}

          {state.phase === "error" ? (
            <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <div className="font-medium">היצירה נכשלה</div>
              <div className="text-xs">{state.error}</div>
              <Button size="sm" variant="outline" onClick={onRetry}>
                נסה שוב
              </Button>
            </div>
          ) : null}

          {state.iterations.map((it) => (
            <IterationCard
              key={it.version}
              iteration={it}
              isLatest={it.version === totalVersions}
              busy={busy}
              onToggleNote={(noteId) => onToggleNote(it.version, noteId)}
              onSelectAll={() =>
                onSetSelection(
                  it.version,
                  new Set((it.review?.notes ?? []).map((n) => n.id)),
                )
              }
              onClear={() => onSetSelection(it.version, new Set())}
              onImprove={onImprove}
              onFinish={() => onFinish(it.specId)}
            />
          ))}
        </div>

        <DialogFooter className="border-t border-border pt-3">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            סגור
          </Button>
          {last ? (
            <Button onClick={() => onFinish(last.specId)} disabled={busy}>
              פתח את הגרסה האחרונה לעריכה
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PhaseBanner({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>{text}</span>
    </div>
  );
}

function IterationCard({
  iteration,
  isLatest,
  busy,
  onToggleNote,
  onSelectAll,
  onClear,
  onImprove,
  onFinish,
}: {
  iteration: Iteration;
  isLatest: boolean;
  busy: boolean;
  onToggleNote: (noteId: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onImprove: () => void;
  onFinish: () => void;
}) {
  const { spec, review, version } = iteration;
  const stats = [
    { label: "מטרות", n: spec.goals.length },
    { label: "דרישות פונק'", n: spec.functional_requirements.length },
    { label: "דרישות לא-פונק'", n: spec.non_functional_requirements.length },
    { label: "תרחישים", n: spec.use_cases.length },
  ];
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            v{version}
          </span>
          <h3 className="font-semibold text-foreground">{spec.title}</h3>
        </div>
        {typeof review?.score === "number" ? (
          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
            ציון {review.score}/10
          </span>
        ) : null}
      </div>
      {spec.overview ? (
        <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">
          {spec.overview}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-md border border-border bg-muted/30 p-2 text-center"
          >
            <div className="text-base font-semibold text-foreground">{s.n}</div>
            <div className="text-[10px] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {isLatest && review ? (
        <ReviewSuggestionsPanel
          review={review}
          selected={iteration.selectedNoteIds}
          onToggle={onToggleNote}
          onSelectAll={onSelectAll}
          onClear={onClear}
          onImprove={onImprove}
          onFinish={onFinish}
          improving={busy}
        />
      ) : null}
    </div>
  );
}


function EditableDocTitle({
  id,
  value,
  className,
}: {
  id: string;
  value: string;
  className?: string;
}) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateSpec);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = async () => {
    setEditing(false);
    const next = draft.trim();
    if (!next || next === value) {
      setDraft(value);
      return;
    }
    try {
      await updateFn({ data: { id, title: next } });
      qc.invalidateQueries({ queryKey: ["project"] });

      toast.success("השם עודכן");
    } catch (e) {
      setDraft(value);
      toast.error(e instanceof Error ? e.message : "עדכון השם נכשל");
    }
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") { e.preventDefault(); void commit(); }
          if (e.key === "Escape") { e.preventDefault(); setDraft(value); setEditing(false); }
        }}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        dir="auto"
        className={`min-w-0 flex-1 rounded border border-primary bg-background px-1.5 py-0.5 outline-none focus:ring-2 focus:ring-primary/40 ${className ?? ""}`}
      />
    );
  }

  return (
    <span
      className={`${className ?? ""} cursor-text rounded outline-dashed outline-1 outline-transparent transition-colors hover:outline-primary/40`}
      title="דאבל-קליק לעריכת שם"
      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDraft(value);
        setEditing(true);
      }}
    >
      {value}
    </span>
  );
}

function EditableGroupPrompt({
  groupId,
  value,
  className,
}: {
  groupId: string;
  value: string;
  className?: string;
}) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateGroupPrompt);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = async () => {
    setEditing(false);
    const next = draft.trim();
    if (!next || next === value) {
      setDraft(value);
      return;
    }
    try {
      await updateFn({ data: { groupId, prompt: next } });
      qc.invalidateQueries({ queryKey: ["project"] });

      toast.success("התיאור עודכן");
    } catch (e) {
      setDraft(value);
      toast.error(e instanceof Error ? e.message : "עדכון נכשל");
    }
  };

  if (editing) {
    return (
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void commit(); }
          if (e.key === "Escape") { e.preventDefault(); setDraft(value); setEditing(false); }
        }}
        onClick={(e) => e.stopPropagation()}
        dir="auto"
        rows={Math.max(2, Math.min(8, draft.split("\n").length + 1))}
        className={`w-full rounded border border-primary bg-background px-1.5 py-1 outline-none focus:ring-2 focus:ring-primary/40 ${className ?? ""}`}
      />
    );
  }

  return (
    <h3
      className={`${className ?? ""} cursor-text rounded outline-dashed outline-1 outline-transparent transition-colors hover:outline-primary/40`}
      title="דאבל-קליק לעריכת התיאור (חל על כל הגרסאות בקבוצה)"
      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDraft(value);
        setEditing(true);
      }}
    >
      {value}
    </h3>
  );
}

