import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, Check, Plus, Trash2 } from "lucide-react";

import { getSpec, updateSpec } from "@/lib/spec.functions";
import { ReviewPanel } from "@/components/review-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

function EditorPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getFn = useServerFn(getSpec);
  const updateFn = useServerFn(updateSpec);

  const { data, isLoading, error } = useQuery({
    queryKey: ["spec", id],
    queryFn: () => getFn({ data: { id } }),
  });

  const [title, setTitle] = useState("");
  const [content, setContent] = useState<SpecContent | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const lastSentRef = useRef<string>("");

  useEffect(() => {
    if (data?.spec) {
      setTitle(data.spec.title);
      const normalized = normalizeSpec(data.spec.content);
      setContent(normalized);
      lastSentRef.current = JSON.stringify({ title: data.spec.title, content: normalized });
    }
  }, [data?.spec]);

  const saveMut = useMutation({
    mutationFn: (patch: { title?: string; content?: SpecContent }) =>
      updateFn({ data: { id, ...patch } }),
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
    const snapshot = JSON.stringify({ title, content });
    if (snapshot === lastSentRef.current) return;
    const t = setTimeout(() => {
      lastSentRef.current = snapshot;
      saveMut.mutate({ title, content });
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content]);

  const updateContent = useCallback((updater: (c: SpecContent) => SpecContent) => {
    setContent((prev) => (prev ? updater(prev) : prev));
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-57px)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error || !data?.spec || !content) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="text-sm text-destructive">
          {(error as Error)?.message ?? "המסמך לא נמצא"}
        </p>
        <Link to="/dashboard" className="mt-4 inline-block text-sm text-primary underline">
          חזרה לרשימת המסמכים
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Toolbar */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/dashboard" })}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          <span className="hidden sm:inline">חזרה</span>
        </Button>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-8 max-w-md flex-1 text-sm"
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
      <div className="mx-auto w-full max-w-4xl px-4 py-8 space-y-10">
        {typeof data.spec.review_score === "number" ? (
          <ReviewPanel
            review={{
              score: data.spec.review_score,
              notes: Array.isArray(data.spec.review_notes)
                ? (data.spec.review_notes as string[])
                : [],
            }}
          />
        ) : null}

        {/* Overview */}
        <Section title="1. סקירה כללית">
          <EditableText
            value={content.overview}
            onChange={(v) => updateContent((c) => ({ ...c, overview: v }))}
            multiline
            placeholder="תיאור כללי של המערכת..."
          />
        </Section>

        {/* Goals */}
        <ListSection<TextItem>
          title="2. מטרות"
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

        {/* Personas */}
        <ListSection<Persona>
          title="3. משתמשי קצה"
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

        {/* Functional Requirements */}
        <ListSection<Requirement>
          title="4. דרישות פונקציונליות"
          items={content.functional_requirements}
          onChange={(items) => updateContent((c) => ({ ...c, functional_requirements: items }))}
          newItem={() => ({ id: newId(), title: "", description: "" })}
          renderItem={(item, onChange) => <RequirementCard item={item} onChange={onChange} />}
          addLabel="הוסף דרישה"
        />

        {/* Non-Functional Requirements */}
        <ListSection<Requirement>
          title="5. דרישות לא־פונקציונליות"
          items={content.non_functional_requirements}
          onChange={(items) => updateContent((c) => ({ ...c, non_functional_requirements: items }))}
          newItem={() => ({ id: newId(), title: "", description: "" })}
          renderItem={(item, onChange) => <RequirementCard item={item} onChange={onChange} />}
          addLabel="הוסף דרישה"
        />

        {/* Assumptions */}
        <ListSection<TextItem>
          title="6. הנחות יסוד"
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

        {/* Use Cases */}
        <ListSection<UseCase>
          title="7. תרחישי שימוש"
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

        {/* Architecture */}
        <Section title="8. ארכיטקטורה">
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
        </Section>

        {/* Data Model */}
        <Section title="9. מודל נתונים">
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
        </Section>

        {/* Risks */}
        <ListSection<TextItem>
          title="10. סיכונים"
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
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="border-b border-border pb-2 text-xl font-semibold text-foreground">
        {title}
      </h2>
      <div className="rounded-lg border border-border bg-card p-4">{children}</div>
    </section>
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

interface ListSectionProps<T extends { id: string }> {
  title: string;
  items: T[];
  onChange: (items: T[]) => void;
  newItem: () => T;
  renderItem: (item: T, onChange: (next: T) => void) => React.ReactNode;
  addLabel: string;
}

function ListSection<T extends { id: string }>({
  title,
  items,
  onChange,
  newItem,
  renderItem,
  addLabel,
}: ListSectionProps<T>) {
  return (
    <section className="space-y-3">
      <h2 className="border-b border-border pb-2 text-xl font-semibold text-foreground">
        {title}
      </h2>
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
    </section>
  );
}
