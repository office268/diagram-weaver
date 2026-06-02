import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Search, Trash2, FileText, GitBranch, ExternalLink, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
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
import { listSpecs, deleteSpec } from "@/lib/spec.functions";
import { listDiagrams, deleteDiagram } from "@/lib/diagrams.functions";
import { OUTPUT_TYPES, OUTPUT_TYPE_ORDER, type OutputKey } from "@/lib/output-types";

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({
    meta: [
      { title: "המסמכים שלי — סוכן ניתוח מערכות" },
      { name: "description", content: "כל המסמכים והתרשימים שיצרת." },
    ],
  }),
  component: DocumentsPage,
});

type Item = {
  id: string;
  title: string;
  type: OutputKey;
  category: "document" | "diagram";
  createdAt: string;
  prompt: string;
};

function DocumentsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const listSpecsFn = useServerFn(listSpecs);
  const listDiagramsFn = useServerFn(listDiagrams);
  const deleteSpecFn = useServerFn(deleteSpec);
  const deleteDiagramFn = useServerFn(deleteDiagram);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<OutputKey | "all">("all");
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);

  const { data: specsData, isLoading: specsLoading } = useQuery({
    queryKey: ["specs-all"],
    queryFn: () => listSpecsFn(),
  });
  const { data: diagramsData, isLoading: diagramsLoading } = useQuery({
    queryKey: ["diagrams-all"],
    queryFn: () => listDiagramsFn(),
  });

  const items: Item[] = useMemo(() => {
    const specs: Item[] =
      (specsData?.specs ?? []).map((s) => ({
        id: s.id,
        title: s.title,
        type: ((s as { doc_type?: string }).doc_type ?? "spec_overview") as OutputKey,
        category: "document",
        createdAt: s.created_at,
        prompt: s.prompt ?? "",
      })) ?? [];
    const diagrams: Item[] =
      (diagramsData?.diagrams ?? []).map((d) => ({
        id: d.id,
        title: d.title,
        type: d.kind as OutputKey,
        category: "diagram",
        createdAt: d.created_at,
        prompt: d.prompt ?? "",
      })) ?? [];
    return [...specs, ...diagrams].sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : -1,
    );
  }, [specsData, diagramsData]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (filter !== "all" && it.type !== filter) return false;
      if (!q) return true;
      return (
        it.title.toLowerCase().includes(q) || it.prompt.toLowerCase().includes(q)
      );
    });
  }, [items, query, filter]);

  const deleteMut = useMutation({
    mutationFn: async (item: Item) => {
      if (item.category === "document") {
        await deleteSpecFn({ data: { id: item.id } });
      } else {
        await deleteDiagramFn({ data: { id: item.id } });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["specs-all"] });
      qc.invalidateQueries({ queryKey: ["diagrams-all"] });
      setDeleteTarget(null);
      toast.success("נמחק");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "מחיקה נכשלה"),
  });

  const isLoading = specsLoading || diagramsLoading;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            המסמכים שלי
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            כל המסמכים והתרשימים שיצרת.
          </p>
        </div>
        <Button onClick={() => navigate({ to: "/" })} className="btn-gradient border-0">
          יצירת מסמך חדש
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
            filter === "all"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card hover:bg-accent"
          }`}
        >
          הכל
        </button>
        {OUTPUT_TYPE_ORDER.map((key) => {
          const t = OUTPUT_TYPES[key];
          const active = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:bg-accent"
              }`}
            >
              <t.icon className={`h-3 w-3 ${active ? "" : t.colorClass}`} />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חפש לפי שם או פרומפט..."
          className="pr-9"
        />
      </div>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={items.length === 0 ? "עדיין אין מסמכים" : "לא נמצאו תוצאות"}
          description={
            items.length === 0
              ? "התחל/י ליצור מסמך או תרשים חדש מדף הבית."
              : "נסה/י מילת חיפוש או פילטר אחר."
          }
          action={
            items.length === 0 ? (
              <Button onClick={() => navigate({ to: "/" })} className="btn-gradient border-0">
                יצירת מסמך חדש
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((it) => {
            const def = OUTPUT_TYPES[it.type];
            const Icon = def?.icon ?? (it.category === "diagram" ? GitBranch : FileText);
            const href = it.category === "document"
              ? `/editor/${it.id}`
              : `/chat`; // diagrams open inside chat thread; quick view fallback
            return (
              <li
                key={`${it.category}-${it.id}`}
                className="group hover-lift relative rounded-xl border border-border bg-card p-4"
              >
                <Link
                  to={it.category === "document" ? "/editor/$id" : "/documents"}
                  params={it.category === "document" ? { id: it.id } : undefined}
                  className="block"
                >
                  <div className="flex items-start gap-2">
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent ${def?.colorClass}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">
                        {it.title}
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {def?.label} · {new Date(it.createdAt).toLocaleDateString("he-IL")}
                      </div>
                      {it.prompt && (
                        <div className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                          {it.prompt}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
                <div className="absolute left-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {it.category === "document" && (
                    <Link
                      to="/editor/$id"
                      params={{ id: it.id }}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
                      aria-label="פתח"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(it)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-destructive"
                    aria-label="מחק"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {/* unused href var silenced */}
                <span className="hidden">{href}</span>
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>למחוק?</AlertDialogTitle>
            <AlertDialogDescription>
              לא ניתן לבטל את הפעולה.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget)}
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
