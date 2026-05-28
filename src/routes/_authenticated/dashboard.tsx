import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, FileCode, Trash2, Loader2, Sparkles } from "lucide-react";
import { AiPromptDialog } from "@/components/ai-prompt-dialog";
import {
  listDiagrams,
  createDiagram,
  deleteDiagram,
} from "@/lib/diagrams.functions";
import { Button } from "@/components/ui/button";
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
import { DIAGRAM_TEMPLATES } from "@/lib/mermaid-utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Your diagrams — Mermaid Studio" },
      { name: "description", content: "All your Mermaid diagrams in one place." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listFn = useServerFn(listDiagrams);
  const createFn = useServerFn(createDiagram);
  const deleteFn = useServerFn(deleteDiagram);

  const [type, setType] = useState<string>("flowchart");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["diagrams"],
    queryFn: () => listFn(),
  });

  const createMut = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          diagram_type: type,
          code: DIAGRAM_TEMPLATES[type]?.code,
          title: `New ${DIAGRAM_TEMPLATES[type]?.label ?? "diagram"}`,
        },
      }),
    onSuccess: ({ diagram }) => {
      qc.invalidateQueries({ queryKey: ["diagrams"] });
      navigate({ to: "/editor/$id", params: { id: diagram.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to create"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["diagrams"] });
      toast.success("Diagram deleted");
      setDeleteId(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to delete"),
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Your diagrams
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create, edit, and export Mermaid diagrams.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(DIAGRAM_TEMPLATES).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setAiOpen(true)}>
            <Sparkles className="mr-2 h-4 w-4" />
            Generate with AI
          </Button>
          <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
            {createMut.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            New diagram
          </Button>
        </div>
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
        ) : !data?.diagrams.length ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
            <FileCode className="mx-auto h-10 w-10 text-muted-foreground" />
            <h3 className="mt-4 font-medium text-foreground">No diagrams yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick a template above and hit "New diagram".
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.diagrams.map((d) => (
              <li
                key={d.id}
                className="group relative flex flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <Link
                  to="/editor/$id"
                  params={{ id: d.id }}
                  className="flex-1"
                >
                  <div className="flex items-center gap-2">
                    <FileCode className="h-4 w-4 text-primary" />
                    <span className="truncate font-medium text-foreground">
                      {d.title}
                    </span>
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">
                    {DIAGRAM_TEMPLATES[d.diagram_type]?.label ?? d.diagram_type} ·
                    Updated {new Date(d.updated_at).toLocaleDateString()}
                  </div>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-2 h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
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

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete diagram?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMut.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AiPromptDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        defaultType={type}
        onGenerated={async ({ code, title, diagram_type }) => {
          try {
            const { diagram } = await createFn({
              data: { code, title, diagram_type },
            });
            qc.invalidateQueries({ queryKey: ["diagrams"] });
            navigate({ to: "/editor/$id", params: { id: diagram.id } });
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to create");
          }
        }}
      />
    </div>
  );
}
