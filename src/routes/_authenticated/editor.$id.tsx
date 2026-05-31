import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Loader2, Save, Check, Plus, Trash2, ChevronUp, ChevronDown, Pencil, ChevronRight, ChevronLeft, Sparkles, X, GripVertical } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { getDocTypeVisual } from "@/lib/doc-types";
import { getProject } from "@/lib/project.functions";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { getSpec, updateSpec, createSpec } from "@/lib/spec.functions";
import { ReviewSuggestionsPanel } from "@/components/review-suggestions-panel";
import {
  normalizeReviewNotes,
  SpecOutputSchema,
  extractJson,
  type SpecOutput,
  type SpecReview,
} from "@/lib/spec-output-schema";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EditableText } from "@/components/editable-text";
import { SpecDiagram } from "@/components/spec-diagram";
import {
  normalizeSpec,
  newId,
  type SpecContent,
  type Requirement,
  type TextItem,
  type Persona,
  type UseCase,
} from "@/lib/spec-schema";

export const Route = createFileRoute("/_authenticated/editor/$id")({
  head: () => ({
    meta: [
      { title: "עורך מסמך אפיון — סוכן ניתוח מערכות" },
      {
        name: "description",
        content: "עריכת מסמך אפיון על: דרישות, הנחות יסוד, תרחישים, ארכיטקטורה ומודל נתונים.",
      },
      { property: "og:title", content: "עורך מסמך אפיון — סוכן ניתוח מערכות" },
    ],
  }),
  component: EditorPage,
});

// Default ordered list of section keys + their default Hebrew titles.
const DEFAULT_SECTIONS: { key: string; defaultTitle: string }[] = [
  { key: "user_prompt", defaultTitle: "הפרומפט של המשתמש" },
  { key: "overview", defaultTitle: "סקירה כללית" },
  { key: "goals", defaultTitle: "מטרות" },
  { key: "personas", defaultTitle: "משתמשי קצה" },
  { key: "functional_requirements", defaultTitle: "דרישות פונקציונליות" },
  { key: "non_functional_requirements", defaultTitle: "דרישות לא־פונקציונליות" },
  { key: "assumptions", defaultTitle: "הנחות יסוד" },
  { key: "use_cases", defaultTitle: "תרחישי שימוש" },
  { key: "architecture", defaultTitle: "ארכיטקטורה" },
  { key: "data_model", defaultTitle: "מודל נתונים" },
  { key: "risks", defaultTitle: "סיכונים" },
  { key: "review", defaultTitle: "ביקורת הסוכן המבקר" },
  { key: "user_notes", defaultTitle: "ההערות שלי" },
];
const DEFAULT_KEYS = DEFAULT_SECTIONS.map((s) => s.key);

function EditorPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getFn = useServerFn(getSpec);
  const updateFn = useServerFn(updateSpec);
  const createFn = useServerFn(createSpec);
  const getProjectFn = useServerFn(getProject);

  const { data, isLoading, error } = useQuery({
    queryKey: ["spec", id],
    queryFn: () => getFn({ data: { id } }),
  });

  const projectId = (data?.spec as { project_id?: string | null } | undefined)?.project_id ?? null;
  const docType = (data?.spec as { doc_type?: string } | undefined)?.doc_type ?? null;
  const { data: projectData } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProjectFn({ data: { id: projectId as string } }),
    enabled: !!projectId,
  });
  const projectName = projectData?.project?.name ?? null;
  const docVisual = getDocTypeVisual(docType);
  const DocIcon = docVisual.icon;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState<SpecContent | null>(null);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
  const [improving, setImproving] = useState(false);
  const [userNotes, setUserNotes] = useState("");
  const [prompt, setPrompt] = useState("");
  const [sectionOrder, setSectionOrder] = useState<string[]>(DEFAULT_KEYS);
  const [sectionTitles, setSectionTitles] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const lastSentRef = useRef<string>("");

  useEffect(() => {
    if (data?.spec) {
      setTitle(data.spec.title);
      const normalized = normalizeSpec(data.spec.content);
      setContent(normalized);
      const notes = (data.spec as { user_notes?: string }).user_notes ?? "";
      const uPrompt = (data.spec as { user_prompt?: string }).user_prompt ?? "";
      const savedOrder = (data.spec as { section_order?: string[] }).section_order;
      const savedTitles = (data.spec as { section_titles?: Record<string, string> }).section_titles ?? {};
      // Reconcile: keep saved order, append any new default keys missing, drop unknown keys.
      const validSaved = Array.isArray(savedOrder) && savedOrder.length > 0
        ? savedOrder.filter((k) => DEFAULT_KEYS.includes(k))
        : [];
      const missing = DEFAULT_KEYS.filter((k) => !validSaved.includes(k));
      const order = validSaved.length > 0 ? [...validSaved, ...missing] : DEFAULT_KEYS;
      setSectionOrder(order);
      setSectionTitles(savedTitles);
      setUserNotes(notes);
      setPrompt(uPrompt);
      lastSentRef.current = JSON.stringify({
        title: data.spec.title,
        content: normalized,
        userNotes: notes,
        userPrompt: uPrompt,
        sectionOrder: order,
        sectionTitles: savedTitles,
      });
    }
  }, [data?.spec]);

  const saveMut = useMutation({
    mutationFn: (patch: {
      title?: string;
      content?: SpecContent;
      userNotes?: string;
      userPrompt?: string;
      sectionOrder?: string[];
      sectionTitles?: Record<string, string>;
    }) => updateFn({ data: { id, ...patch } }),
    onMutate: () => setSaveState("saving"),
    onSuccess: () => {
      setSaveState("saved");
      qc.invalidateQueries({ queryKey: ["specs"] });
      setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1500);
    },
    onError: (e) => {
      setSaveState("idle");
      toast.error(e instanceof Error ? e.message : "שמירה נכשלה");
    },
  });

  // Debounced autosave
  useEffect(() => {
    if (!content) return;
    const snapshot = JSON.stringify({ title, content, userNotes, userPrompt: prompt, sectionOrder, sectionTitles });
    if (snapshot === lastSentRef.current) return;
    const t = setTimeout(() => {
      lastSentRef.current = snapshot;
      saveMut.mutate({ title, content, userNotes, userPrompt: prompt, sectionOrder, sectionTitles });
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content, userNotes, prompt, sectionOrder, sectionTitles]);

  const updateContent = useCallback((updater: (c: SpecContent) => SpecContent) => {
    setContent((prev) => (prev ? updater(prev) : prev));
  }, []);

  const moveSection = useCallback((key: string, dir: -1 | 1) => {
    setSectionOrder((prev) => {
      const idx = prev.indexOf(key);
      const j = idx + dir;
      if (idx < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }, []);

  const setSectionTitle = useCallback((key: string, value: string) => {
    setSectionTitles((prev) => {
      const next = { ...prev };
      if (!value.trim()) delete next[key];
      else next[key] = value;
      return next;
    });
  }, []);

  const deleteSection = useCallback((key: string) => {
    let removedIndex = -1;
    setSectionOrder((prev) => {
      const idx = prev.indexOf(key);
      if (idx < 0) return prev;
      removedIndex = idx;
      return prev.filter((k) => k !== key);
    });
    if (removedIndex < 0) return;
    const restoreAt = removedIndex;
    toast.success("הסעיף נמחק", {
      duration: 8000,
      action: {
        label: "בטל",
        onClick: () => {
          setSectionOrder((cur) => {
            if (cur.includes(key)) return cur;
            const next = [...cur];
            const at = Math.min(Math.max(restoreAt, 0), next.length);
            next.splice(at, 0, key);
            return next;
          });
        },
      },
    });
  }, []);

  const reorderSections = useCallback((from: string, to: string) => {
    setSectionOrder((prev) => {
      const oldIndex = prev.indexOf(from);
      const newIndex = prev.indexOf(to);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );


  const ensureIds = useCallback(<T extends { id?: string }>(items: unknown): T[] => {
    if (!Array.isArray(items)) return [];
    return items.map((it) => {
      if (it && typeof it === "object") {
        const obj = it as Record<string, unknown>;
        if (typeof obj.id !== "string" || !obj.id) {
          return { ...obj, id: newId() } as T;
        }
      }
      return it as T;
    });
  }, []);

  const getSectionValue = useCallback(
    (key: string): { value: unknown; shape: "string" | "array" | "object" } | null => {
      if (!content) return null;
      switch (key) {
        case "overview": return { value: content.overview, shape: "string" };
        case "goals": return { value: content.goals, shape: "array" };
        case "personas": return { value: content.personas, shape: "array" };
        case "functional_requirements": return { value: content.functional_requirements, shape: "array" };
        case "non_functional_requirements": return { value: content.non_functional_requirements, shape: "array" };
        case "assumptions": return { value: content.assumptions, shape: "array" };
        case "use_cases": return { value: content.use_cases, shape: "array" };
        case "architecture": return { value: content.architecture, shape: "object" };
        case "data_model": return { value: content.data_model, shape: "object" };
        case "risks": return { value: content.risks, shape: "array" };
        case "user_prompt": return { value: prompt, shape: "string" };
        case "user_notes": return { value: userNotes, shape: "string" };
        default: return null;
      }
    },
    [content, prompt, userNotes],
  );

  const applySectionValue = useCallback(
    (key: string, value: unknown) => {
      const asString = () => (typeof value === "string" ? value : JSON.stringify(value));
      const asObject = (fallback: { description: string; diagram: string }) => {
        if (value && typeof value === "object") {
          const obj = value as { description?: unknown; diagram?: unknown };
          return {
            description: typeof obj.description === "string" ? obj.description : fallback.description,
            diagram: typeof obj.diagram === "string" ? obj.diagram : fallback.diagram,
          };
        }
        return fallback;
      };
      switch (key) {
        case "overview":
          updateContent((c) => ({ ...c, overview: asString() })); break;
        case "goals":
          updateContent((c) => ({ ...c, goals: ensureIds<TextItem>(value) })); break;
        case "personas":
          updateContent((c) => ({ ...c, personas: ensureIds<Persona>(value) })); break;
        case "functional_requirements":
          updateContent((c) => ({ ...c, functional_requirements: ensureIds<Requirement>(value) })); break;
        case "non_functional_requirements":
          updateContent((c) => ({ ...c, non_functional_requirements: ensureIds<Requirement>(value) })); break;
        case "assumptions":
          updateContent((c) => ({ ...c, assumptions: ensureIds<TextItem>(value) })); break;
        case "use_cases":
          updateContent((c) => ({ ...c, use_cases: ensureIds<UseCase>(value) })); break;
        case "architecture":
          updateContent((c) => ({ ...c, architecture: asObject(c.architecture) })); break;
        case "data_model":
          updateContent((c) => ({ ...c, data_model: asObject(c.data_model) })); break;
        case "risks":
          updateContent((c) => ({ ...c, risks: ensureIds<TextItem>(value) })); break;
        case "user_prompt":
          setPrompt(asString()); break;
        case "user_notes":
          setUserNotes(asString()); break;
      }
    },
    [updateContent, ensureIds],
  );

  const improveSection = useCallback(
    async (key: string, label: string, instruction: string): Promise<boolean> => {
      const cur = getSectionValue(key);
      if (!cur) {
        toast.error("לא ניתן לשפר סעיף זה");
        return false;
      }
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token) throw new Error("נדרשת התחברות מחדש");
        const res = await fetch("/api/improve-section", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            sectionKey: key,
            sectionLabel: label,
            sectionValue: cur.value,
            valueShape: cur.shape,
            instruction,
            contextPrompt: prompt,
            docType: (data?.spec as { doc_type?: string } | undefined)?.doc_type,
          }),
        });
        if (!res.ok) {
          const t = (await res.text().catch(() => "")) || `שגיאה ${res.status}`;
          throw new Error(t);
        }
        const json = (await res.json()) as { value: unknown };
        applySectionValue(key, json.value);
        toast.success("הסעיף עודכן");
        return true;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "שיפור הסעיף נכשל");
        return false;
      }
    },
    [getSectionValue, applySectionValue, prompt, data?.spec],
  );

  const improveDoc = useCallback(async () => {
    if (!data?.spec || !content) return;
    const reviewNotes = normalizeReviewNotes(
      (data.spec as { review_notes?: unknown }).review_notes,
    );
    const selectedTexts = reviewNotes
      .filter((n) => selectedNoteIds.has(n.id))
      .map((n) => n.text);
    if (selectedTexts.length === 0) {
      toast.warning("בחר/י לפחות הצעה אחת להטמיע");
      return;
    }
    setImproving(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("נדרשת התחברות מחדש");

      const spec = data.spec as unknown as {
        prompt: string;
        title: string;
        doc_type?: string;
        group_id?: string | null;
        project_id?: string | null;
        section_order?: string[];
        section_titles?: Record<string, string>;
        model?: string | null;
      };
      const model = spec.model ?? "";
      const promptText = spec.prompt ?? "";
      const docType = spec.doc_type ?? "spec_overview";

      // 1) Generate revised spec
      const genRes = await fetch("/api/generate-spec", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          prompt: promptText,
          model,
          docType,
          previousSpec: content,
          reviewerNotes: selectedTexts,
        }),
      });
      if (!genRes.ok || !genRes.body) {
        const t = (await genRes.text().catch(() => "")) || `שגיאה ${genRes.status}`;
        throw new Error(t);
      }
      const reader = genRes.body.getReader();
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
        throw new Error(fullText.slice(errIdx + "__STREAM_ERROR__:".length).trim() || "שגיאת זרם");
      }
      const parsed = JSON.parse(extractJson(fullText));
      const newSpec: SpecOutput = SpecOutputSchema.parse(parsed);

      // 2) Review
      let newReview: SpecReview | null = null;
      try {
        const revRes = await fetch("/api/review-spec", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ prompt: promptText, spec: newSpec }),
        });
        if (revRes.ok) {
          const j = await revRes.json();
          if (j?.score != null) {
            newReview = { score: Number(j.score), notes: normalizeReviewNotes(j.notes) };
          }
        }
      } catch {
        // non-fatal
      }

      // 3) Save as new revised version under same group
      const { spec: row } = await createFn({
        data: {
          title: `${newSpec.title} — גרסה משופרת`,
          prompt: promptText,
          content: newSpec,
          reviewScore: newReview?.score ?? null,
          reviewNotes: newReview?.notes ?? [],
          groupId: spec.group_id ?? null,
          model,
          variant: "revised",
          docType,
          sectionOrder: spec.section_order ?? [],
          sectionTitles: spec.section_titles ?? {},
          projectId: spec.project_id ?? null,
        },
      });

      qc.invalidateQueries({ queryKey: ["project"] });
      toast.success("נוצרה גרסה משופרת");
      setSelectedNoteIds(new Set());
      navigate({ to: "/editor/$id", params: { id: row.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "יצירת גרסה משופרת נכשלה");
    } finally {
      setImproving(false);
    }
  }, [data?.spec, content, selectedNoteIds, createFn, qc, navigate]);

  // Build a body renderer for each section key.
  const renderBody = useMemo(() => {
    if (!content) return null;
    return (key: string): React.ReactNode => {
      switch (key) {
        case "user_prompt":
          return (
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={Math.max(3, Math.min(15, prompt.split("\n").length + 1))}
              placeholder="הפרומפט של המשתמש... (נשמר אוטומטית, משפיע רק על המסמך הזה)"
              dir="auto"
              className="resize-y text-sm"
            />
          );
        case "overview":
          return (
            <EditableText
              value={content.overview}
              onChange={(v) => updateContent((c) => ({ ...c, overview: v }))}
              multiline
              placeholder="תיאור כללי של המערכת..."
            />
          );
        case "goals":
          return (
            <ListBody<TextItem>
              items={content.goals}
              onChange={(items) => updateContent((c) => ({ ...c, goals: items }))}
              newItem={() => ({ id: newId(), text: "" })}
              renderItem={(item, onChange) => (
                <EditableText
                  value={item.text}
                  onChange={(v) => onChange({ ...item, text: v })}
                  multiline
                  placeholder="מטרה..."
                />
              )}
              addLabel="הוסף מטרה"
            />
          );
        case "personas":
          return (
            <ListBody<Persona>
              items={content.personas}
              onChange={(items) => updateContent((c) => ({ ...c, personas: items }))}
              newItem={() => ({ id: newId(), name: "", description: "" })}
              renderItem={(item, onChange) => (
                <div className="space-y-2">
                  <EditableText
                    value={item.name}
                    onChange={(v) => onChange({ ...item, name: v })}
                    placeholder="שם הפרסונה"
                    className="font-medium"
                  />
                  <EditableText
                    value={item.description}
                    onChange={(v) => onChange({ ...item, description: v })}
                    multiline
                    placeholder="תיאור..."
                  />
                </div>
              )}
              addLabel="הוסף פרסונה"
            />
          );
        case "functional_requirements":
          return (
            <ListBody<Requirement>
              items={content.functional_requirements}
              onChange={(items) => updateContent((c) => ({ ...c, functional_requirements: items }))}
              newItem={() => ({ id: newId(), title: "", description: "" })}
              renderItem={(item, onChange) => <RequirementCard item={item} onChange={onChange} />}
              addLabel="הוסף דרישה"
            />
          );
        case "non_functional_requirements":
          return (
            <ListBody<Requirement>
              items={content.non_functional_requirements}
              onChange={(items) => updateContent((c) => ({ ...c, non_functional_requirements: items }))}
              newItem={() => ({ id: newId(), title: "", description: "" })}
              renderItem={(item, onChange) => <RequirementCard item={item} onChange={onChange} />}
              addLabel="הוסף דרישה"
            />
          );
        case "assumptions":
          return (
            <ListBody<TextItem>
              items={content.assumptions}
              onChange={(items) => updateContent((c) => ({ ...c, assumptions: items }))}
              newItem={() => ({ id: newId(), text: "" })}
              renderItem={(item, onChange) => (
                <EditableText
                  value={item.text}
                  onChange={(v) => onChange({ ...item, text: v })}
                  multiline
                  placeholder="הנחת יסוד..."
                />
              )}
              addLabel="הוסף הנחה"
            />
          );
        case "use_cases":
          return (
            <ListBody<UseCase>
              items={content.use_cases}
              onChange={(items) => updateContent((c) => ({ ...c, use_cases: items }))}
              newItem={() => ({ id: newId(), title: "", description: "", diagram: "" })}
              renderItem={(item, onChange) => (
                <div className="space-y-3">
                  <EditableText
                    value={item.title}
                    onChange={(v) => onChange({ ...item, title: v })}
                    placeholder="כותרת התרחיש"
                    className="font-medium"
                  />
                  <EditableText
                    value={item.description}
                    onChange={(v) => onChange({ ...item, description: v })}
                    multiline
                    placeholder="תיאור התרחיש..."
                  />
                  <SpecDiagram
                    code={item.diagram ?? ""}
                    onChange={(code) => onChange({ ...item, diagram: code })}
                  />
                </div>
              )}
              addLabel="הוסף תרחיש"
            />
          );
        case "architecture":
          return (
            <div className="rounded-lg border border-border bg-card p-4">
              <EditableText
                value={content.architecture.description}
                onChange={(v) =>
                  updateContent((c) => ({ ...c, architecture: { ...c.architecture, description: v } }))
                }
                multiline
                placeholder="תיאור הארכיטקטורה..."
              />
              <div className="mt-4">
                <SpecDiagram
                  code={content.architecture.diagram ?? ""}
                  onChange={(code) =>
                    updateContent((c) => ({ ...c, architecture: { ...c.architecture, diagram: code } }))
                  }
                />
              </div>
            </div>
          );
        case "data_model":
          return (
            <div className="rounded-lg border border-border bg-card p-4">
              <EditableText
                value={content.data_model.description}
                onChange={(v) =>
                  updateContent((c) => ({ ...c, data_model: { ...c.data_model, description: v } }))
                }
                multiline
                placeholder="תיאור מודל הנתונים..."
              />
              <div className="mt-4">
                <SpecDiagram
                  code={content.data_model.diagram ?? ""}
                  onChange={(code) =>
                    updateContent((c) => ({ ...c, data_model: { ...c.data_model, diagram: code } }))
                  }
                />
              </div>
            </div>
          );
        case "risks":
          return (
            <ListBody<TextItem>
              items={content.risks}
              onChange={(items) => updateContent((c) => ({ ...c, risks: items }))}
              newItem={() => ({ id: newId(), text: "" })}
              renderItem={(item, onChange) => (
                <EditableText
                  value={item.text}
                  onChange={(v) => onChange({ ...item, text: v })}
                  multiline
                  placeholder="סיכון..."
                />
              )}
              addLabel="הוסף סיכון"
            />
          );
        case "review": {
          if (typeof data?.spec.review_score !== "number") return null;
          const review: SpecReview = {
            score: data.spec.review_score,
            notes: normalizeReviewNotes(data.spec.review_notes),
          };
          return (
            <ReviewSuggestionsPanel
              review={review}
              selected={selectedNoteIds}
              onToggle={(noteId) =>
                setSelectedNoteIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(noteId)) next.delete(noteId);
                  else next.add(noteId);
                  return next;
                })
              }
              onSelectAll={() =>
                setSelectedNoteIds(new Set(review.notes.map((n) => n.id)))
              }
              onClear={() => setSelectedNoteIds(new Set())}
              onImprove={improveDoc}
              onFinish={() => navigate({ to: "/projects" })}
              improving={improving}
            />
          );
        }

        case "user_notes":
          return (
            <div className="rounded-lg border border-border bg-card p-4">
              <Textarea
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                rows={6}
                placeholder="כתוב כאן הערות אישיות לגבי המסמך... (נשמר אוטומטית)"
                className="resize-y"
              />
            </div>
          );
        default:
          return null;
      }
    };
  }, [content, prompt, userNotes, updateContent, data?.spec, selectedNoteIds, improving, improveDoc, navigate]);

  if (isLoading) {
    return <EditorSkeleton />;
  }
  if (error || !data?.spec || !content || !renderBody) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="text-sm text-destructive">
          {(error as Error)?.message ?? "המסמך לא נמצא"}
        </p>
        <Link to="/projects" className="mt-4 inline-block text-sm text-primary underline">
          חזרה לרשימת המסמכים
        </Link>
      </div>
    );
  }

  // Filter out sections that render nothing (e.g. review when no score).
  const visibleSections = sectionOrder.filter((key) => {
    if (key === "review" && typeof data.spec.review_score !== "number") return false;
    return DEFAULT_KEYS.includes(key);
  });

  return (
    <div className="flex flex-col">
      {/* Toolbar */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2">
        <Breadcrumb className="min-w-0 flex-1">
          <BreadcrumbList className="flex-nowrap">
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/projects">פרויקטים</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            {projectId ? (
              <>
                <BreadcrumbSeparator>
                  <ChevronLeft />
                </BreadcrumbSeparator>
                <BreadcrumbItem className="hidden sm:inline-flex min-w-0">
                  <BreadcrumbLink asChild>
                    <Link
                      to="/projects/$projectId"
                      params={{ projectId }}
                      className="truncate max-w-[14rem] inline-block align-bottom"
                    >
                      {projectName ?? "פרויקט"}
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </>
            ) : null}
            <BreadcrumbSeparator>
              <ChevronLeft />
            </BreadcrumbSeparator>
            <BreadcrumbItem className="min-w-0">
              <BreadcrumbPage className="flex min-w-0 items-center gap-1.5">
                <DocIcon className={`h-3.5 w-3.5 shrink-0 ${docVisual.colorClass}`} />
                <span className="truncate max-w-[10rem] sm:max-w-[20rem]">
                  {title || "מסמך"}
                </span>
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-8 w-full max-w-md text-sm sm:flex-1"
          placeholder="כותרת המסמך"
        />
        <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          {saveState === "saving" ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> שומר…
            </>
          ) : saveState === "saved" ? (
            <>
              <Check className="h-3 w-3 text-primary" /> נשמר
            </>
          ) : (
            <>
              <Save className="h-3 w-3" /> שמירה אוטומטית
            </>
          )}
        </div>
      </div>

      {/* Document */}
      <div className="mx-auto w-full max-w-4xl px-4 py-8 space-y-8">
        <DndContext
          sensors={dndSensors}
          collisionDetection={closestCenter}
          onDragEnd={(e: DragEndEvent) => {
            const { active, over } = e;
            if (!over || active.id === over.id) return;
            reorderSections(String(active.id), String(over.id));
          }}
        >
          <SortableContext items={visibleSections} strategy={verticalListSortingStrategy}>
            {visibleSections.map((key, index) => {
              const def = DEFAULT_SECTIONS.find((s) => s.key === key)!;
              const titleValue = sectionTitles[key] ?? def.defaultTitle;
              return (
                <SortableSection key={key} id={key}>
                  {(dragHandle) => (
                    <SectionShell
                      title={titleValue}
                      dragHandle={dragHandle}
                      onTitleChange={(v) => setSectionTitle(key, v)}
                      onMoveUp={index > 0 ? () => moveSection(key, -1) : undefined}
                      onMoveDown={index < visibleSections.length - 1 ? () => moveSection(key, 1) : undefined}
                      onDelete={() => deleteSection(key)}
                      onAiImprove={
                        key === "review"
                          ? undefined
                          : (instruction) => improveSection(key, titleValue, instruction)
                      }
                    >
                      {renderBody(key)}
                    </SectionShell>
                  )}
                </SortableSection>
              );
            })}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}

function SectionShell({
  title,
  onTitleChange,
  onMoveUp,
  onMoveDown,
  onDelete,
  onAiImprove,
  dragHandle,
  children,
}: {
  title: string;
  onTitleChange: (v: string) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDelete?: () => void;
  onAiImprove?: (instruction: string) => Promise<boolean>;
  dragHandle?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [open, setOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const startEdit = () => {
    setDraft(title);
    setEditing(true);
    setOpen(true);
  };

  const handleAiSubmit = async () => {
    if (!onAiImprove || aiPrompt.trim().length < 3) return;
    setAiBusy(true);
    const ok = await onAiImprove(aiPrompt.trim());
    setAiBusy(false);
    if (ok) {
      setAiPrompt("");
      setAiOpen(false);
      setOpen(true);
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <section className="space-y-3">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <div className="flex flex-col">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-5 w-7 p-0"
              disabled={!onMoveUp}
              onClick={onMoveUp}
              aria-label="הזז למעלה"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-5 w-7 p-0"
              disabled={!onMoveDown}
              onClick={onMoveDown}
              aria-label="הזז למטה"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              aria-label={open ? "סגור סעיף" : "פתח סעיף"}
            >
              <ChevronRight
                className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`}
              />
            </Button>
          </CollapsibleTrigger>
          {editing ? (
            <Input
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => {
                onTitleChange(draft);
                setEditing(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onTitleChange(draft);
                  setEditing(false);
                } else if (e.key === "Escape") {
                  setDraft(title);
                  setEditing(false);
                }
              }}
              className="h-9 max-w-md text-xl font-semibold"
            />
          ) : (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              onDoubleClick={startEdit}
              className="group flex flex-1 items-center gap-2 text-right text-xl font-semibold text-foreground hover:text-primary"
              title="לחץ לפתיחה/סגירה. דאבל-קליק או כפתור עריכה לעריכת שם הסעיף"
            >
              <span>{title}</span>
            </button>
          )}

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={startEdit}
              title="עריכת שם הסעיף"
              aria-label="עריכה"
            >
              <Pencil className="h-4 w-4" />
            </Button>

            {onAiImprove ? (
              <Popover
                open={aiOpen}
                onOpenChange={(o) => {
                  if (aiBusy) return;
                  setAiOpen(o);
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-primary"
                    title="שיפור הסעיף עם AI"
                    aria-label="שיפור עם AI"
                  >
                    <Sparkles className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-foreground">
                      שיפור עם AI
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => setAiOpen(false)}
                      disabled={aiBusy}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    תאר/י כיצד לשפר את הסעיף "{title}".
                  </p>
                  <Textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    rows={4}
                    placeholder="למשל: הוסף פירוט תפעולי, תקן ניסוחים, פצל לסעיפים..."
                    disabled={aiBusy}
                    autoFocus
                    dir="auto"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setAiOpen(false)}
                      disabled={aiBusy}
                    >
                      ביטול
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAiSubmit}
                      disabled={aiBusy || aiPrompt.trim().length < 3}
                    >
                      {aiBusy ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      שפר
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            ) : null}

            {onDelete ? (
              confirmDelete ? (
                <div className="flex items-center gap-1 rounded-md border border-destructive/40 bg-destructive/5 px-1.5">
                  <span className="text-[11px] text-destructive">למחוק?</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      onDelete();
                      setConfirmDelete(false);
                    }}
                  >
                    כן
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setConfirmDelete(false)}
                  >
                    לא
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setConfirmDelete(true)}
                  title="מחיקת הסעיף מהמסמך"
                  aria-label="מחיקה"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )
            ) : null}
          </div>
        </div>
        <CollapsibleContent>{children}</CollapsibleContent>
      </section>
    </Collapsible>
  );
}

function RequirementCard({
  item,
  onChange,
}: {
  item: Requirement;
  onChange: (next: Requirement) => void;
}) {
  return (
    <div className="space-y-2">
      <EditableText
        value={item.title}
        onChange={(v) => onChange({ ...item, title: v })}
        placeholder="כותרת הדרישה"
        className="font-medium"
      />
      <EditableText
        value={item.description}
        onChange={(v) => onChange({ ...item, description: v })}
        multiline
        placeholder="תיאור הדרישה..."
      />
    </div>
  );
}

interface ListBodyProps<T extends { id: string }> {
  items: T[];
  onChange: (items: T[]) => void;
  newItem: () => T;
  renderItem: (item: T, onChange: (next: T) => void) => React.ReactNode;
  addLabel: string;
}

function ListBody<T extends { id: string }>({
  items,
  onChange,
  newItem,
  renderItem,
  addLabel,
}: ListBodyProps<T>) {
  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {items.map((item, idx) => (
          <li
            key={item.id}
            className="group relative rounded-lg border border-border bg-card p-4"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">#{idx + 1}</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onChange(items.filter((it) => it.id !== item.id))}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" /> מחק
              </Button>
            </div>
            {renderItem(item, (next) =>
              onChange(items.map((it) => (it.id === item.id ? next : it))),
            )}
          </li>
        ))}
        {items.length === 0 && (
          <li className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            אין פריטים. לחץ "הוסף" כדי להתחיל.
          </li>
        )}
      </ul>
      <Button variant="outline" size="sm" onClick={() => onChange([...items, newItem()])}>
        <Plus className="mr-1.5 h-4 w-4" /> {addLabel}
      </Button>
    </div>
  );
}
