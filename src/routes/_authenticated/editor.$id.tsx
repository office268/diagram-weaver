// ============================================================
// src/routes/_authenticated/editor.$id.tsx
// מסך מאומת (Authenticated route) — editor.$id.tsx
// דורש משתמש מחובר; יושב תחת layout _authenticated
// ============================================================
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Loader2, Save, Check, Plus, Trash2, ChevronUp, ChevronDown, Pencil, ChevronRight, ChevronLeft, Sparkles, X, GripVertical, Search, Maximize2, Minimize2, Columns2, MoreVertical, Download, Undo2, Redo2, Bold, Italic, Underline, Cloud, Upload, Table as TableIcon, Image as ImageIcon, Link as LinkIcon, MessageSquare, Share2, History, Type } from "lucide-react";
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
import { printAsPdf } from "@/lib/spec/export";
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
import { getDocTypeVisual, getDocType } from "@/lib/doc-types";

const DOC_TYPE_EN: Record<string, string> = {
  business_requirements: "Business Requirements Document (BRD)",
  technical_requirements: "Technical Requirements Document (TRD)",
  requirements_combined: "Business + Technical Requirements Document",
  initiation: "Project Initiation Document",
  spec_overview: "High-Level Design (HLD)",
  spec_detailed: "Low-Level Design (LLD)",
};
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

import { getSpec, updateSpec, createSpec, getDocUsageTotals, logSpecUsage } from "@/lib/spec/spec.functions";
import { ReviewSuggestionsPanel } from "@/components/review-suggestions-panel";
import {
  normalizeReviewNotes,
  SpecOutputSchema,
  extractJson,
  type SpecOutput,
  type SpecReview,
} from "@/lib/spec/output-schema";
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
} from "@/lib/spec/schema";

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
  const getUsageFn = useServerFn(getDocUsageTotals);
  const logUsageFn = useServerFn(logSpecUsage);

  const { data, isLoading, error } = useQuery({
    queryKey: ["spec", id],
    queryFn: () => getFn({ data: { id } }),
  });

  const { data: usageData } = useQuery({
    queryKey: ["spec-usage", id],
    queryFn: () => getUsageFn({ data: { id } }),
    staleTime: 30_000,
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
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
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

  // Debounced autosave — defer JSON.stringify into the timer so typing stays cheap
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!content) return;
    setDirty(true);
    const t = setTimeout(() => {
      const snapshot = JSON.stringify({ title, content, userNotes, userPrompt: prompt, sectionOrder, sectionTitles });
      if (snapshot === lastSentRef.current) {
        setDirty(false);
        return;
      }
      lastSentRef.current = snapshot;
      saveMut.mutate({ title, content, userNotes, userPrompt: prompt, sectionOrder, sectionTitles });
      setDirty(false);
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            docId: id,
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
    [getSectionValue, prompt, data?.spec, projectId, id],
  );

  const applyImprovement = useCallback(
    (key: string, candidate: unknown, previous: unknown) => {
      applySectionValue(key, candidate);
      qc.invalidateQueries({ queryKey: ["spec-usage", id] });
      toast.success("הסעיף עודכן", {
        duration: 8000,
        action: {
          label: "בטל",
          onClick: () => applySectionValue(key, previous),
        },
      });
    },
    [applySectionValue, qc, id],
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

      // Stream payload contract: <spec JSON>\n__REVIEW__\n<review JSON>\n__USAGE__\n<usage JSON>
      const sepIdx = fullText.indexOf("__REVIEW__");
      const usageIdx = fullText.indexOf("__USAGE__");
      const specText = sepIdx >= 0 ? fullText.slice(0, sepIdx) : fullText;
      const reviewText =
        sepIdx >= 0
          ? fullText.slice(
              sepIdx + "__REVIEW__".length,
              usageIdx >= 0 ? usageIdx : undefined,
            )
          : "";
      const usageText =
        usageIdx >= 0 ? fullText.slice(usageIdx + "__USAGE__".length) : "";

      const parsed = JSON.parse(extractJson(specText));
      const newSpec: SpecOutput = SpecOutputSchema.parse(parsed);

      let usagePayload: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        costUsd: number;
      } | null = null;
      if (usageText.trim()) {
        try {
          const u = JSON.parse(extractJson(usageText));
          usagePayload = {
            inputTokens: Number(u.inputTokens ?? 0),
            outputTokens: Number(u.outputTokens ?? 0),
            totalTokens: Number(u.totalTokens ?? 0),
            costUsd: Number(u.costUsd ?? 0),
          };
        } catch (e) {
          console.warn("[generate-spec] usage parse failed:", e);
        }
      }

      // 2) Review — use inline review from stream if present, else call /api/review-spec.
      let newReview: SpecReview | null = null;
      if (reviewText.trim()) {
        try {
          const rawReview = JSON.parse(extractJson(reviewText));
          if (rawReview?.score != null) {
            newReview = {
              score: Number(rawReview.score),
              notes: normalizeReviewNotes(rawReview.notes),
            };
          }
        } catch (e) {
          console.warn("[generate-spec] inline review parse failed:", e);
        }
      }
      if (!newReview) {
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

      // 4) Log AI usage against the newly-created doc
      if (usagePayload) {
        try {
          await logUsageFn({
            data: {
              docId: row.id,
              model: "multi-agent",
              purpose: "regenerate",
              inputTokens: usagePayload.inputTokens,
              outputTokens: usagePayload.outputTokens,
              totalTokens: usagePayload.totalTokens,
              costUsd: usagePayload.costUsd,
            },
          });
        } catch (e) {
          console.warn("[generate-spec] logUsage failed:", e);
        }
      }

      qc.invalidateQueries({ queryKey: ["project"] });
      qc.invalidateQueries({ queryKey: ["spec-usage", row.id] });
      toast.success("נוצרה גרסה משופרת");
      setSelectedNoteIds(new Set());
      navigate({ to: "/editor/$id", params: { id: row.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "יצירת גרסה משופרת נכשלה");
    } finally {
      setImproving(false);
    }
  }, [data?.spec, content, selectedNoteIds, createFn, qc, navigate, logUsageFn]);

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
            <div className="space-y-4">
              <EditableText
                value={content.architecture.description}
                onChange={(v) =>
                  updateContent((c) => ({ ...c, architecture: { ...c.architecture, description: v } }))
                }
                multiline
                placeholder="תיאור הארכיטקטורה..."
              />
              <SpecDiagram
                code={content.architecture.diagram ?? ""}
                onChange={(code) =>
                  updateContent((c) => ({ ...c, architecture: { ...c.architecture, diagram: code } }))
                }
              />
            </div>
          );
        case "data_model":
          return (
            <div className="space-y-4">
              <EditableText
                value={content.data_model.description}
                onChange={(v) =>
                  updateContent((c) => ({ ...c, data_model: { ...c.data_model, description: v } }))
                }
                multiline
                placeholder="תיאור מודל הנתונים..."
              />
              <SpecDiagram
                code={content.data_model.diagram ?? ""}
                onChange={(code) =>
                  updateContent((c) => ({ ...c, data_model: { ...c.data_model, diagram: code } }))
                }
              />
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
          "sticky top-0 z-30 flex items-center justify-center gap-1 border-b px-3 py-1.5 backdrop-blur transition-colors",
          focusMode
            ? "border-transparent bg-background/60 supports-[backdrop-filter]:bg-background/40"
            : "border-border bg-card/95 supports-[backdrop-filter]:bg-card/80",
        )}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              title="הוספה"
              aria-label="הוספה"
              onMouseDown={(e) => e.preventDefault()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 text-right" style={{ direction: "rtl" }}>
            <DropdownMenuItem
              onSelect={() => {
                const url = window.prompt("כתובת התמונה (URL):");
                if (!url) return;
                const html = `<img src="${url.replace(/"/g, "&quot;")}" alt="" style="max-width:100%;height:auto" /><p>&nbsp;</p>`;
                document.execCommand("insertHTML", false, html);
              }}
            >
              <ImageIcon className="ml-2 h-4 w-4" />
              תמונה
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                const url = window.prompt("כתובת הקישור (URL):");
                if (!url) return;
                const text = window.prompt("טקסט הקישור:", url) || url;
                const safeUrl = url.replace(/"/g, "&quot;");
                const html = `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${text}</a>`;
                document.execCommand("insertHTML", false, html);
              }}
            >
              <LinkIcon className="ml-2 h-4 w-4" />
              קישור
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                const rows = 3;
                const cols = 3;
                let html = '<table style="border-collapse:collapse;width:100%;margin:8px 0" border="1">';
                for (let r = 0; r < rows; r++) {
                  html += "<tr>";
                  for (let c = 0; c < cols; c++) {
                    html += '<td style="border:1px solid #ccc;padding:6px;min-width:60px">&nbsp;</td>';
                  }
                  html += "</tr>";
                }
                html += "</table><p>&nbsp;</p>";
                document.execCommand("insertHTML", false, html);
              }}
            >
              <TableIcon className="ml-2 h-4 w-4" />
              טבלה
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                const note = window.prompt("תוכן ההערה:");
                if (!note) return;
                const safe = note.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                const html = `<aside style="border-right:3px solid #f59e0b;background:#fef3c7;color:#78350f;padding:8px 12px;margin:8px 0;border-radius:4px">${safe}</aside><p>&nbsp;</p>`;
                document.execCommand("insertHTML", false, html);
              }}
            >
              <MessageSquare className="ml-2 h-4 w-4" />
              הערה
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              title="שיתוף"
              aria-label="שיתוף"
              onMouseDown={(e) => e.preventDefault()}
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 text-right" style={{ direction: "rtl" }}>
            <DropdownMenuItem onSelect={() => toast.info("העלאה ל-SharePoint — בקרוב")}>
              <svg viewBox="0 0 32 32" className="ml-2 h-4 w-4" aria-hidden>
                <circle cx="12" cy="11" r="8" fill="#036c70"/>
                <circle cx="21" cy="17" r="7" fill="#1a9ba1"/>
                <circle cx="17" cy="25" r="5" fill="#37c6d0"/>
              </svg>
              SharePoint
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => toast.info("העלאה ל-Google Workspace — בקרוב")}>
              <svg viewBox="0 0 87.3 78" className="ml-2 h-4 w-4" aria-hidden>
                <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
                <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
              </svg>
              Google Workspace
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => toast.info("העלאה ל-OneDrive — בקרוב")}>
              <svg viewBox="0 0 32 20" className="ml-2 h-4 w-4" aria-hidden>
                <path d="M19.4 8.2a6.5 6.5 0 0 0-12.4-1.4 5.5 5.5 0 0 0-.7 10.9h17.5a4.7 4.7 0 0 0 .9-9.3 5.3 5.3 0 0 0-5.3-.2z" fill="#0364b8"/>
                <path d="M7 6.8a6.5 6.5 0 0 1 12.4 1.4 5.3 5.3 0 0 1 5.3.2 4.7 4.7 0 0 1 2.1 2.1L19.5 17H6.3a5.5 5.5 0 0 1 .7-10.2z" fill="#0078d4"/>
              </svg>
              OneDrive
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                const ok = printAsPdf({
                  title: title || "מסמך",
                  content,
                  userPrompt: prompt,
                  userNotes,
                  sectionOrder: visibleSections,
                  sectionTitles,
                  reviewScore: data.spec.review_score ?? null,
                });
                if (!ok) toast.error("חסום על ידי הדפדפן — אפשרו חלונות קופצים");
              }}
            >
              <Download className="ml-2 h-4 w-4" />
              הורדה
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="mx-1 h-5 w-px bg-border" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onMouseDown={(e) => { e.preventDefault(); document.execCommand("undo"); }}
          title="בטל (Cmd/Ctrl+Z)"
          aria-label="בטל"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onMouseDown={(e) => { e.preventDefault(); document.execCommand("redo"); }}
          title="בצע שוב (Cmd/Ctrl+Shift+Z)"
          aria-label="בצע שוב"
        >
          <Redo2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => setHistoryOpen(true)}
          title="היסטוריית גרסאות"
          aria-label="היסטוריית גרסאות"
        >
          <History className="h-4 w-4" />
        </Button>
        <div className="mx-1 h-5 w-px bg-border" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onMouseDown={(e) => { e.preventDefault(); document.execCommand("underline"); }}
          title="קו תחתון"
          aria-label="קו תחתון"
        >
          <Underline className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onMouseDown={(e) => { e.preventDefault(); document.execCommand("bold"); }}
          title="מודגש"
          aria-label="מודגש"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onMouseDown={(e) => { e.preventDefault(); document.execCommand("italic"); }}
          title="נטוי"
          aria-label="נטוי"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              title="גודל פונט"
              aria-label="גודל פונט"
              onMouseDown={(e) => e.preventDefault()}
            >
              <Type className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="text-right" style={{ direction: "rtl" }}>
            {[
              { size: "1", label: "קטן מאוד" },
              { size: "2", label: "קטן" },
              { size: "3", label: "רגיל" },
              { size: "4", label: "בינוני" },
              { size: "5", label: "גדול" },
              { size: "6", label: "גדול מאוד" },
              { size: "7", label: "ענק" },
            ].map((opt) => (
              <DropdownMenuItem
                key={opt.size}
                onMouseDown={(e) => e.preventDefault()}
                onSelect={() => document.execCommand("fontSize", false, opt.size)}
              >
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="mx-1 h-5 w-px bg-border" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => setAiDialogOpen(true)}
          title="עוזר AI — פרומפט והצעות לשיפור"
          aria-label="עוזר AI"
        >
          <Sparkles className="h-4 w-4 text-primary" />
        </Button>
        <div className="mx-1 h-5 w-px bg-border" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              title="קפיצה לסעיף"
              aria-label="קפיצה לסעיף"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="max-h-80 overflow-y-auto text-right" style={{ direction: "rtl" }}>
            {visibleSections.map((key, idx) => (
              <DropdownMenuItem
                key={key}
                onSelect={() => {
                  const el = document.getElementById(`section-${key}`);
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                <span className="tabular-nums text-muted-foreground ms-2">{idx + 1}.</span>
                <span className="truncate">{sectionTitles[key] ?? key}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>


      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              היסטוריית גרסאות
            </DialogTitle>
            <DialogDescription>גרסאות קודמות של המסמך</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="rounded-md border border-border bg-card p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">גרסה נוכחית</span>
                <span className="text-xs text-muted-foreground">
                  {data?.spec.updated_at
                    ? formatDistanceToNow(new Date(data.spec.updated_at), { addSuffix: true, locale: he })
                    : "—"}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                השמירה אוטומטית. שמירת היסטוריית גרסאות מלאה תהיה זמינה בקרוב.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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

      {/* AI assistant dialog — editable user prompt + reviewer suggestions */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-right">
              <Sparkles className="h-4 w-4 text-primary" />
              עוזר AI
            </DialogTitle>
            <DialogDescription className="text-right">
              הפרומפט שלך והצעות השיפור מהסוכן המבקר.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">הפרומפט שלך</div>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={Math.max(4, Math.min(15, prompt.split("\n").length + 1))}
                placeholder="הפרומפט שלך... (נשמר אוטומטית)"
                dir="auto"
                className="resize-y text-sm"
              />
            </div>
            {typeof data?.spec?.review_score === "number" ? (
              <div className="space-y-2">
                <div className="text-sm font-medium text-foreground">הצעות לשיפור</div>
                <ReviewSuggestionsPanel
                  review={{
                    score: data.spec.review_score,
                    notes: normalizeReviewNotes(data.spec.review_notes),
                  }}
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
                    setSelectedNoteIds(
                      new Set(
                        normalizeReviewNotes(data.spec.review_notes).map((n) => n.id),
                      ),
                    )
                  }
                  onClear={() => setSelectedNoteIds(new Set())}
                  onImprove={() => {
                    setAiDialogOpen(false);
                    improveDoc();
                  }}
                  onFinish={() => setAiDialogOpen(false)}
                  improving={improving}
                />
              </div>
            ) : (
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                אין כרגע הצעות לשיפור מהסוכן המבקר.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>



      {/* Document — print-preview layout: separate A4 pages, page numbers, numbered sections */}
      <div className="bg-muted/40 py-6 sm:py-10">
        {splitSecondaryKey ? (
          <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 grid gap-6 lg:grid-cols-2">
            <div
              className={cn(
                "rounded-sm border border-border bg-card text-foreground shadow-[0_4px_18px_-6px_rgba(0,0,0,0.18)]",
                "px-6 py-10 sm:px-16 sm:py-20 space-y-8 min-w-0",
              )}
            >
              <header className="border-b border-border/60 pb-4">
                <h1 className="text-2xl sm:text-3xl font-bold leading-tight text-foreground">
                  {title || "מסמך"}
                </h1>
              </header>
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
                              title={`${index + 1}. ${titleValue}`}
                              displayTitle={`${index + 1}. ${titleValue}`}
                              editableTitle={titleValue}
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
          </div>
        ) : (
          <div className="mx-auto w-full max-w-[210mm] px-3 sm:px-6 space-y-6 sm:space-y-10">
            {/* Cover page */}
            <article
              className={cn(
                "rounded-sm border border-border bg-card text-foreground shadow-[0_4px_18px_-6px_rgba(0,0,0,0.18)]",
                "flex flex-col px-6 py-10 sm:px-16 sm:py-20 min-w-0",
              )}
            >
              <div className="flex flex-col">
                <div className="text-center space-y-4 pt-8 sm:pt-16">
                  <div className="text-sm sm:text-base text-muted-foreground font-medium">
                    {projectName || "ללא פרויקט"}
                  </div>
                  <h1
                    className="text-3xl sm:text-5xl font-bold leading-tight text-foreground outline-none focus:ring-2 focus:ring-primary/40 rounded px-2 -mx-2"
                    contentEditable
                    suppressContentEditableWarning
                    spellCheck={false}
                    onBlur={(e) => {
                      const v = e.currentTarget.textContent?.trim() ?? "";
                      if (v && v !== title) setTitle(v);
                      else if (!v) e.currentTarget.textContent = title || "מסמך";
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); }
                    }}
                  >
                    {title || "מסמך"}
                  </h1>

                  <div className="space-y-1">
                    <div className="text-base sm:text-lg text-foreground">
                      {getDocType(docType).label}
                    </div>
                    <div className="text-sm sm:text-base text-muted-foreground" dir="ltr">
                      {DOC_TYPE_EN[docType ?? "spec_overview"] ?? DOC_TYPE_EN.spec_overview}
                    </div>
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground pt-2">
                    {(() => {
                      const d = (data?.spec as { updated_at?: string } | undefined)?.updated_at;
                      const dateStr = d
                        ? new Date(d).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" })
                        : new Date().toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
                      const variant = (data?.spec as { variant?: string } | undefined)?.variant;
                      const versionLabel = variant === "revised" ? "גרסה 2.0" : "גרסה 1.0";
                      return `${dateStr} · ${versionLabel}`;
                    })()}
                  </div>
                </div>
                <div className="mt-12 sm:mt-16 border-t border-border pt-6 sm:pt-8">
                  <h2 className="text-lg sm:text-xl font-semibold mb-4 text-foreground">תוכן עניינים</h2>
                  <ol className="space-y-2">
                    {visibleSections.map((key, i) => {
                      const def = DEFAULT_SECTIONS.find((s) => s.key === key)!;
                      const titleValue = sectionTitles[key] ?? def.defaultTitle;
                      const pageNum = i + 2;
                      return (
                        <li key={key}>
                          <a
                            href={`#section-${key}`}
                            onClick={(e) => {
                              e.preventDefault();
                              document.getElementById(`section-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                            }}
                            className="flex items-baseline gap-2 text-sm sm:text-base text-foreground hover:text-primary transition-colors group"
                          >
                            <span className="font-medium tabular-nums">{i + 1}.</span>
                            <span className="group-hover:underline">{titleValue}</span>
                            <span className="flex-1 border-b border-dotted border-muted-foreground/40 mx-2 translate-y-[-3px]" />
                            <span className="text-xs text-muted-foreground tabular-nums">עמוד {pageNum}</span>
                          </a>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </div>
              <footer className="pt-8 text-center text-xs text-muted-foreground">
                עמוד 1 מתוך {visibleSections.length + 1}
              </footer>
            </article>


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
                  const pageNumber = index + 2;
                  const totalPages = visibleSections.length + 1;
                  return (
                    <SortableSection key={key} id={key}>
                      {(dragHandle) => (
                        <article
                          id={`section-${key}`}
                          className={cn(
                            "group/section scroll-mt-20 rounded-sm border border-border bg-card text-foreground shadow-[0_4px_18px_-6px_rgba(0,0,0,0.18)]",
                            "flex flex-col px-6 py-10 sm:px-16 sm:py-20 min-w-0 transition-opacity",
                            focusMode && "opacity-40 hover:opacity-100 focus-within:opacity-100",
                          )}
                        >
                          <div className="min-w-0">
                            <SectionShell
                              title={`${index + 1}. ${titleValue}`}
                              displayTitle={`${index + 1}. ${titleValue}`}
                              editableTitle={titleValue}
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
                          <footer className="pt-8 text-center text-xs text-muted-foreground">
                            עמוד {pageNumber} מתוך {totalPages}
                          </footer>
                        </article>
                      )}
                    </SortableSection>
                  );
                })}
              </SortableContext>
            </DndContext>
          </div>
        )}
      </div>
      {!focusMode ? (
        <EditorStatusBar
          wordCount={wordCount}
          filledCount={filledCount}
          totalCount={visibleSections.length}
          totalTokens={usageData?.totalTokens ?? null}
          totalCostUsd={usageData?.totalCostUsd ?? null}
        />
      ) : null}
    </div>
  );
}


function SectionShell({
  title,
  displayTitle,
  editableTitle,
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
  displayTitle?: string;
  editableTitle?: string;
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
  const shownTitle = displayTitle ?? title;
  const editTitle = editableTitle ?? title;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(editTitle);
  const [open, setOpen] = useState(true);
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
    setDraft(editTitle);
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
      <section className="space-y-3">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          {dragHandle}
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
                  setDraft(editTitle);
                  setEditing(false);
                }
              }}
              className="h-9 max-w-md text-xl font-semibold"
            />
          ) : (
            <button
              type="button"
              onClick={startEdit}
              className="group flex flex-1 items-center gap-2 text-right text-xl font-semibold text-foreground hover:text-primary"
              title="לחץ לעריכת שם הסעיף"
            >
              <span>{shownTitle}</span>
            </button>
          )}

          <div className="ml-auto flex shrink-0 items-center gap-1" />

        </div>
        <div>{children}</div>
      </section>

    {onAiImprove ? (
      <Dialog open={aiOpen} onOpenChange={(o) => { if (aiBusy) return; setAiOpen(o); }}>
        <DialogContent className="max-w-lg space-y-2">
          <DialogHeader>
            <DialogTitle>שיפור עם AI</DialogTitle>
            <DialogDescription>תאר/י כיצד לשפר את הסעיף "{editTitle}".</DialogDescription>
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
}: ListBodyProps<T>) {
  // Ensure exactly one trailing empty slot so users can keep typing (Word-like flow).
  const isEmptyItem = (it: T): boolean => {
    for (const [key, v] of Object.entries(it as Record<string, unknown>)) {
      if (key === "id") continue;
      if (typeof v === "string" && v.trim() !== "") return false;
    }
    return true;
  };

  useEffect(() => {
    const last = items[items.length - 1];
    if (!last || !isEmptyItem(last)) {
      onChange([...items, newItem()]);
      return;
    }
    // Trim extra trailing empty items (keep just one)
    let cut = items.length;
    while (cut > 1 && isEmptyItem(items[cut - 1]) && isEmptyItem(items[cut - 2])) cut--;
    if (cut !== items.length) onChange(items.slice(0, cut));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {items.map((item, idx) => (
          <li key={item.id} className="relative">
            <span className="pointer-events-none absolute right-0 top-1 text-xs text-muted-foreground tabular-nums">
              {idx + 1}.
            </span>
            <div className="pr-6">
              {renderItem(item, (next) =>
                onChange(items.map((it) => (it.id === item.id ? next : it))),
              )}
            </div>
          </li>
        ))}
      </ul>
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
  void setActivatorNodeRef;
  void attributes;
  void listeners;
  const handle: React.ReactNode = null;
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

