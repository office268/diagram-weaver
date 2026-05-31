import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Loader2, Save, Check, Plus, Trash2, ChevronUp, ChevronDown, Pencil, ChevronRight, ChevronLeft, Sparkles, X, GripVertical, Search, Maximize2, Minimize2, Columns2, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { EditorStatusBar } from "@/components/editor-status-bar";
import { ExportMenu } from "@/components/export-menu";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePromptHistory } from "@/hooks/use-prompt-history";
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
  MouseSensor,
  TouchSensor,
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
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [, setTick] = useState(0);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [focusMode, setFocusMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("editor-focus-mode") === "1";
  });
  const [splitSecondaryKey, setSplitSecondaryKey] = useState<string | null>(null);
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
      setLastSavedAt(new Date());
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

  // Dirty = pending unsaved changes (debounce hasn't flushed yet)
  const dirty = useMemo(() => {
    if (!content) return false;
    const snapshot = JSON.stringify({ title, content, userNotes, userPrompt: prompt, sectionOrder, sectionTitles });
    return snapshot !== lastSentRef.current;
  }, [title, content, userNotes, prompt, sectionOrder, sectionTitles]);

  // Warn before unload if there are pending changes
  useEffect(() => {
    if (!dirty && saveState !== "saving") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, saveState]);

  // Refresh "saved X ago" label every 30s
  useEffect(() => {
    if (!lastSavedAt) return;
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, [lastSavedAt]);

  const savedAgoLabel = useMemo(() => {
    if (!lastSavedAt) return null;
    try {
      return formatDistanceToNow(lastSavedAt, { addSuffix: true, locale: he });
    } catch {
      return null;
    }
  }, [lastSavedAt]);

  const flushSave = useCallback(() => {
    if (!content) return;
    const snapshot = JSON.stringify({ title, content, userNotes, userPrompt: prompt, sectionOrder, sectionTitles });
    if (snapshot === lastSentRef.current) return;
    lastSentRef.current = snapshot;
    saveMut.mutate({ title, content, userNotes, userPrompt: prompt, sectionOrder, sectionTitles });
  }, [title, content, userNotes, prompt, sectionOrder, sectionTitles, saveMut]);

  // Keyboard shortcuts: Cmd/Ctrl+S to save, Cmd/Ctrl+Shift+K to open section search
  // (Cmd+K is reserved for the global command palette.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        flushSave();
      } else if ((e.key === "k" || e.key === "K") && e.shiftKey) {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flushSave]);

  // Focus mode: persist + 'f' shortcut + auto-close split when shrinking below lg
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("editor-focus-mode", focusMode ? "1" : "0");
  }, [focusMode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (e.key !== "f" && e.key !== "F") return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || t?.isContentEditable) return;
      e.preventDefault();
      setFocusMode((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(min-width: 1024px)");
    const apply = () => {
      if (!mql.matches) setSplitSecondaryKey(null);
    };
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, []);


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
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 12 } }),
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
    async (
      key: string,
      label: string,
      instruction: string,
    ): Promise<{ candidate: unknown; previous: unknown } | null> => {
      const cur = getSectionValue(key);
      if (!cur) {
        toast.error("לא ניתן לשפר סעיף זה");
        return null;
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
            projectId: projectId ?? undefined,
          }),

        });
        if (!res.ok) {
          const t = (await res.text().catch(() => "")) || `שגיאה ${res.status}`;
          throw new Error(t);
        }
        const json = (await res.json()) as { value: unknown };
        return { candidate: json.value, previous: cur.value };
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "שיפור הסעיף נכשל");
        return null;
      }
    },
    [getSectionValue, prompt, data?.spec, projectId],
  );

  const applyImprovement = useCallback(
    (key: string, candidate: unknown, previous: unknown) => {
      applySectionValue(key, candidate);
      toast.success("הסעיף עודכן", {
        duration: 8000,
        action: {
          label: "בטל",
          onClick: () => applySectionValue(key, previous),
        },
      });
    },
    [applySectionValue],
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
          projectId: spec.project_id ?? undefined,
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
          body: JSON.stringify({ prompt: promptText, spec: newSpec, projectId: spec.project_id ?? undefined }),
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

  // Filter out sections that render nothing (must be before any early return to keep hook order stable)
  const visibleSections = useMemo(
    () =>
      sectionOrder.filter((key) => {
        if (key === "review" && typeof data?.spec?.review_score !== "number") return false;
        return DEFAULT_KEYS.includes(key);
      }),
    [sectionOrder, data?.spec?.review_score],
  );

  // Word & fill stats for status bar / progress
  const { wordCount, filledCount } = useMemo(() => {
    if (!content) return { wordCount: 0, filledCount: 0 };
    const countWords = (s: string) => {
      const trimmed = (s ?? "").trim();
      if (!trimmed) return 0;
      return trimmed.split(/\s+/u).length;
    };
    const sectionText = (key: string): string => {
      switch (key) {
        case "user_prompt": return prompt;
        case "user_notes": return userNotes;
        case "overview": return content.overview;
        case "goals": return content.goals.map((g) => g.text).join(" ");
        case "assumptions": return content.assumptions.map((g) => g.text).join(" ");
        case "risks": return content.risks.map((g) => g.text).join(" ");
        case "personas": return content.personas.map((p) => `${p.name} ${p.description}`).join(" ");
        case "functional_requirements": return content.functional_requirements.map((r) => `${r.title} ${r.description}`).join(" ");
        case "non_functional_requirements": return content.non_functional_requirements.map((r) => `${r.title} ${r.description}`).join(" ");
        case "use_cases": return content.use_cases.map((u) => `${u.title} ${u.description}`).join(" ");
        case "architecture": return content.architecture.description;
        case "data_model": return content.data_model.description;
        default: return "";
      }
    };
    let words = 0;
    let filled = 0;
    for (const key of visibleSections) {
      const text = sectionText(key);
      const w = countWords(text);
      words += w;
      if (w > 0) filled += 1;
    }
    return { wordCount: words, filledCount: filled };
  }, [content, prompt, userNotes, visibleSections]);

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



  return (
    <div className={cn("flex flex-col", focusMode && "bg-background")}>
      {/* Toolbar */}
      <div
        className={cn(
          "sticky top-0 z-30 flex flex-wrap items-center gap-2 border-b px-3 py-2 backdrop-blur transition-colors",
          focusMode
            ? "border-transparent bg-background/60 supports-[backdrop-filter]:bg-background/40"
            : "border-border bg-card/95 supports-[backdrop-filter]:bg-card/80",
        )}
      >
        <Breadcrumb className={cn("min-w-0 flex-1", focusMode && "hidden")}>
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
          className="order-3 h-8 w-full basis-full text-sm sm:order-none sm:flex-1 sm:basis-auto sm:max-w-md"
          placeholder="כותרת המסמך"
        />
        <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          {saveState === "saving" ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> <span className="hidden sm:inline">שומר…</span>
            </>
          ) : saveState === "saved" ? (
            <>
              <Check className="h-3 w-3 text-primary" /> <span className="hidden sm:inline">נשמר</span>
            </>
          ) : savedAgoLabel ? (
            <>
              <Check className="h-3 w-3 text-primary" />
              <span className="hidden sm:inline" title={lastSavedAt?.toLocaleString("he-IL") ?? ""}>
                נשמר {savedAgoLabel}
              </span>
            </>
          ) : (
            <>
              <Save className="h-3 w-3" /> <span className="hidden sm:inline">שמירה אוטומטית</span>
            </>
          )}
        </div>
        <ExportMenu
          title={title || "מסמך"}
          content={content}
          userPrompt={prompt}
          userNotes={userNotes}
          sectionOrder={visibleSections}
          sectionTitles={sectionTitles}
          reviewScore={data.spec.review_score ?? null}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => setFocusMode((v) => !v)}
          title={focusMode ? "יציאה ממצב מיקוד (F)" : "מצב מיקוד (F)"}
          aria-label={focusMode ? "יציאה ממצב מיקוד" : "מצב מיקוד"}
        >
          {focusMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>


      {/* Section quick-search (Cmd+K) */}
      <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
        <CommandInput placeholder="חפש סעיף... (Cmd/Ctrl+K)" />
        <CommandList>
          <CommandEmpty>לא נמצאו סעיפים</CommandEmpty>
          <CommandGroup heading="סעיפים">
            {visibleSections.map((key) => {
              const def = DEFAULT_SECTIONS.find((s) => s.key === key)!;
              const titleValue = sectionTitles[key] ?? def.defaultTitle;
              return (
                <CommandItem
                  key={key}
                  value={`${titleValue} ${key}`}
                  onSelect={() => {
                    setCmdOpen(false);
                    requestAnimationFrame(() => {
                      const el = document.getElementById(`section-${key}`);
                      if (el) {
                        el.scrollIntoView({ behavior: "smooth", block: "start" });
                        window.dispatchEvent(
                          new CustomEvent("spec-open-section", { detail: key }),
                        );
                      }
                    });
                  }}
                >
                  <Search className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
                  {titleValue}
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {/* Document */}
      <div
        className={cn(
          "mx-auto w-full px-4 py-8",
          splitSecondaryKey
            ? "max-w-7xl grid gap-6 lg:grid-cols-2"
            : focusMode
              ? "max-w-3xl space-y-8"
              : "max-w-4xl space-y-8",
        )}
      >
        <div className={cn(splitSecondaryKey && "space-y-8 min-w-0")}>
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
                      <div
                        className={cn(
                          "group/section transition-opacity",
                          focusMode && "opacity-40 hover:opacity-100 focus-within:opacity-100",
                        )}
                      >
                        <SectionShell
                          title={titleValue}
                          dragHandle={dragHandle}
                          onTitleChange={(v) => setSectionTitle(key, v)}
                          onMoveUp={index > 0 ? () => moveSection(key, -1) : undefined}
                          onMoveDown={index < visibleSections.length - 1 ? () => moveSection(key, 1) : undefined}
                          onDelete={() => deleteSection(key)}
                          sectionKey={key}
                          onSplit={() => setSplitSecondaryKey(key)}
                          splitActive={splitSecondaryKey === key}
                          onAiImprove={
                            key === "review"
                              ? undefined
                              : (instruction) => improveSection(key, titleValue, instruction)
                          }
                          onApplyImprove={(candidate, previous) =>
                            applyImprovement(key, candidate, previous)
                          }
                        >
                          {renderBody(key)}
                        </SectionShell>
                      </div>
                    )}
                  </SortableSection>
                );
              })}
            </SortableContext>
          </DndContext>
        </div>
        {splitSecondaryKey ? (
          <aside className="hidden lg:block min-w-0">
            <div className="lg:sticky lg:top-16 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto rounded-lg border border-primary/30 bg-card/40 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
                <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <Columns2 className="h-4 w-4 text-primary" />
                  <span>תצוגת השוואה: {sectionTitles[splitSecondaryKey] ?? DEFAULT_SECTIONS.find((s) => s.key === splitSecondaryKey)?.defaultTitle ?? splitSecondaryKey}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setSplitSecondaryKey(null)}
                  aria-label="סגור תצוגה משנית"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {renderBody(splitSecondaryKey)}
            </div>
          </aside>
        ) : null}
      </div>
      {!focusMode ? (
        <EditorStatusBar
          wordCount={wordCount}
          filledCount={filledCount}
          totalCount={visibleSections.length}
        />
      ) : null}
    </div>
  );
}


function SectionShell({
  title,
  onTitleChange,
  onMoveUp,
  onMoveDown,
  onDelete,
  sectionKey,
  onAiImprove,
  onApplyImprove,
  onSplit,
  splitActive,
  dragHandle,
  children,
}: {
  title: string;
  onTitleChange: (v: string) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDelete?: () => void;
  sectionKey?: string;
  onAiImprove?: (instruction: string) => Promise<{ candidate: unknown; previous: unknown } | null>;
  onApplyImprove?: (candidate: unknown, previous: unknown) => void;
  onSplit?: () => void;
  splitActive?: boolean;
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
  const [preview, setPreview] = useState<{ candidate: unknown; previous: unknown } | null>(null);
  const history = usePromptHistory(sectionKey ?? "default");

  useEffect(() => {
    if (!sectionKey) return;
    const onOpen = (e: Event) => {
      const ce = e as CustomEvent<string>;
      if (ce.detail === sectionKey) setOpen(true);
    };
    window.addEventListener("spec-open-section", onOpen);
    return () => window.removeEventListener("spec-open-section", onOpen);
  }, [sectionKey]);

  const startEdit = () => {
    setDraft(title);
    setEditing(true);
    setOpen(true);
  };

  const handleAiSubmit = async () => {
    if (!onAiImprove || aiPrompt.trim().length < 3) return;
    const instr = aiPrompt.trim();
    setAiBusy(true);
    const result = await onAiImprove(instr);
    setAiBusy(false);
    if (result) {
      history.add(instr);
      setAiPrompt("");
      setAiOpen(false);
      setPreview(result);
    }
  };

  const formatValue = (v: unknown): string => {
    if (v == null) return "";
    if (typeof v === "string") return v;
    try {
      return JSON.stringify(v, null, 2);
    } catch {
      return String(v);
    }
  };

  return (
    <>
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <section className="space-y-3">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          {dragHandle}
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  title="פעולות"
                  aria-label="פעולות"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onSelect={startEdit}>
                  <Pencil className="ml-2 h-4 w-4" />
                  עריכת שם
                </DropdownMenuItem>
                {onAiImprove ? (
                  <DropdownMenuItem onSelect={() => setAiOpen(true)} className="text-primary">
                    <Sparkles className="ml-2 h-4 w-4" />
                    שיפור עם AI
                  </DropdownMenuItem>
                ) : null}
                {onSplit ? (
                  <DropdownMenuItem onSelect={onSplit}>
                    <Columns2 className="ml-2 h-4 w-4" />
                    {splitActive ? "סגור תצוגת השוואה" : "תצוגת השוואה"}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={!onMoveUp} onSelect={() => onMoveUp?.()}>
                  <ChevronUp className="ml-2 h-4 w-4" />
                  הזז למעלה
                </DropdownMenuItem>
                <DropdownMenuItem disabled={!onMoveDown} onSelect={() => onMoveDown?.()}>
                  <ChevronDown className="ml-2 h-4 w-4" />
                  הזז למטה
                </DropdownMenuItem>
                {onDelete ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => setConfirmDelete(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="ml-2 h-4 w-4" />
                      מחיקה
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <CollapsibleContent>{children}</CollapsibleContent>
      </section>
    </Collapsible>
    {onAiImprove ? (
      <Dialog open={aiOpen} onOpenChange={(o) => { if (aiBusy) return; setAiOpen(o); }}>
        <DialogContent className="max-w-lg space-y-2">
          <DialogHeader>
            <DialogTitle>שיפור עם AI</DialogTitle>
            <DialogDescription>תאר/י כיצד לשפר את הסעיף "{title}".</DialogDescription>
          </DialogHeader>
          <Textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            rows={4}
            placeholder="למשל: הוסף פירוט תפעולי, תקן ניסוחים, פצל לסעיפים..."
            disabled={aiBusy}
            autoFocus
            dir="auto"
          />
          {history.items.length > 0 ? (
            <div className="space-y-1">
              <div className="text-[11px] text-muted-foreground">פרומפטים אחרונים</div>
              <div className="flex flex-wrap gap-1">
                {history.items.map((p) => (
                  <div
                    key={p}
                    className="group inline-flex max-w-full items-center gap-0.5 rounded-full border border-border bg-muted/40 pr-2 text-[11px]"
                  >
                    <button
                      type="button"
                      onClick={() => setAiPrompt(p)}
                      disabled={aiBusy}
                      className="max-w-[14rem] truncate py-0.5 text-foreground hover:text-primary"
                      title={p}
                    >
                      {p}
                    </button>
                    <button
                      type="button"
                      onClick={() => history.remove(p)}
                      disabled={aiBusy}
                      className="rounded-full p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="הסר מההיסטוריה"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => setAiOpen(false)} disabled={aiBusy}>
              ביטול
            </Button>
            <Button type="button" size="sm" onClick={handleAiSubmit} disabled={aiBusy || aiPrompt.trim().length < 3}>
              {aiBusy ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              )}
              שפר
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    ) : null}
    {onDelete ? (
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>למחוק את הסעיף?</DialogTitle>
            <DialogDescription>
              פעולה זו תמחק את "{title}" מהמסמך.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
              ביטול
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => {
                onDelete();
                setConfirmDelete(false);
              }}
            >
              מחק
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    ) : null}
    <Dialog open={!!preview} onOpenChange={(o) => { if (!o) setPreview(null); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>תצוגה מקדימה — שיפור AI</DialogTitle>
          <DialogDescription>
            השווה בין הגרסה הנוכחית להצעת ה-AI ל-"{title}". ניתן לבטל גם לאחר ההחלה.
          </DialogDescription>
        </DialogHeader>
        {preview ? (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">נוכחי</div>
              <pre className="max-h-[50vh] overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs whitespace-pre-wrap" dir="auto">
                {formatValue(preview.previous)}
              </pre>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-primary">הצעת AI</div>
              <pre className="max-h-[50vh] overflow-auto rounded-md border border-primary/40 bg-primary/5 p-3 text-xs whitespace-pre-wrap" dir="auto">
                {formatValue(preview.candidate)}
              </pre>
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setPreview(null)}>
            ביטול
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (preview && onApplyImprove) {
                onApplyImprove(preview.candidate, preview.previous);
              }
              setPreview(null);
              setOpen(true);
            }}
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            החל שינוי
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
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

function SortableSection({
  id,
  children,
}: {
  id: string;
  children: (dragHandle: React.ReactNode) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : undefined,
  };
  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      className="flex h-10 w-10 shrink-0 touch-none select-none items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      style={{ touchAction: "none" }}
      aria-label="גרור לסידור מחדש"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
  return (
    <div ref={setNodeRef} id={`section-${id}`} style={style} className="scroll-mt-20">
      {children(handle)}
    </div>
  );
}

function EditorSkeleton() {
  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-card px-3 py-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-full max-w-md" />
        <Skeleton className="ml-auto h-4 w-20" />
      </div>
      <div className="mx-auto w-full max-w-4xl px-4 py-8 space-y-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <Skeleton className="h-6 w-6" />
              <Skeleton className="h-6 w-48" />
            </div>
            <Skeleton className="h-20 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

