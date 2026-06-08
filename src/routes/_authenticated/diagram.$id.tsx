import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MermaidPreview } from "@/components/mermaid-preview";
import { DiagramRenderer } from "@/components/diagram-renderer";
import { isDiagramRF } from "@/lib/diagram-rf";
import { ActivitySwimlaneRenderer } from "@/components/activity-swimlane-renderer";
import { getDiagram, updateDiagram } from "@/lib/diagrams.functions";
import { OUTPUT_TYPES, type OutputKey } from "@/lib/output-types";

export const Route = createFileRoute("/_authenticated/diagram/$id")({
  head: () => ({
    meta: [{ title: "תרשים — סוכן ניתוח מערכות" }],
  }),
  component: DiagramPage,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-4 py-12 text-center">
      <p className="text-sm text-destructive">{error.message}</p>
      <Button asChild variant="outline" className="mt-4">
        <Link to="/documents">חזרה למסמכים</Link>
      </Button>
    </div>
  ),
});

function DiagramPage() {
  const { id } = Route.useParams();
  const getDiagramFn   = useServerFn(getDiagram);
  const updateDiagramFn = useServerFn(updateDiagram);
  const queryClient    = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["diagram", id],
    queryFn:  () => getDiagramFn({ data: { id } }),
    retry: false,
  });

  const handleSave = useCallback(async (newCode: string) => {
    await updateDiagramFn({ data: { id, mermaid_code: newCode } });
    await queryClient.invalidateQueries({ queryKey: ["diagram", id] });
  }, [id, updateDiagramFn, queryClient]);

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data?.diagram) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "תרשים לא נמצא"}
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/documents">חזרה למסמכים</Link>
        </Button>
      </div>
    );
  }

  const d = data.diagram as {
    id: string;
    title: string;
    kind: string;
    mermaid_code: string;
    prompt?: string | null;
    created_at: string;
  };

  const typeDef  = OUTPUT_TYPES[d.kind as OutputKey];
  const typeLabel = typeDef?.label ?? d.kind;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-6">
      <div className="mb-4 flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/documents">
            <ArrowRight className="ml-1 h-4 w-4" />
            חזרה למסמכים
          </Link>
        </Button>
      </div>

      <div className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {d.title}
        </h1>
        <div className="mt-1 text-xs text-muted-foreground">
          {typeLabel} · {new Date(d.created_at).toLocaleDateString("he-IL")}
        </div>
        {d.prompt && (
          <p className="mt-2 text-sm text-muted-foreground">{d.prompt}</p>
        )}
      </div>

      <div className="h-[70vh] overflow-hidden rounded-xl border border-border bg-card">
        {d.kind === "diagram_activity" ? (
          <ActivitySwimlaneRenderer
            code={d.mermaid_code ?? ""}
            onSave={handleSave}
          />
        ) : isDiagramRF(d.mermaid_code ?? "") ? (
          <DiagramRenderer code={d.mermaid_code ?? ""} onSave={handleSave} />
        ) : (
          <MermaidPreview code={d.mermaid_code ?? ""} />
        )}
      </div>
    </div>
  );
}
