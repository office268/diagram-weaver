import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Search,
  Trash2,
  FileText,
  GitBranch,
  ExternalLink,
  Loader2,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  FileUp,
  X,
  Check,
  Pencil,
  Filter,
} from "lucide-react";


import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
import { listSpecs, deleteSpec, updateSpec } from "@/lib/spec.functions";
import { listDiagrams, deleteDiagram, updateDiagram } from "@/lib/diagrams.functions";
import { listDocuments, deleteDocument, renameDocument } from "@/lib/documents.functions";

import { OUTPUT_TYPES, OUTPUT_TYPE_ORDER, type OutputKey } from "@/lib/output-types";

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({
    meta: [
      { title: "המסמכים שלי — סוכן ניתוח מערכות" },
      { name: "description", content: "כל המסמכים, התרשימים והקבצים שלך." },
    ],
  }),
  component: DocumentsPage,
});

type ItemCategory = "document" | "diagram" | "upload";
type Item = {
  id: string;
  title: string;
  type: OutputKey | "upload";
  category: ItemCategory;
  createdAt: string;
  prompt: string;
  meta?: string; // for uploads: size/mime
};

type SortKey = "date_desc" | "date_asc" | "name" | "type";
type GroupFilter = "all" | "document" | "diagram" | "upload";

const SORT_LABEL: Record<SortKey, string> = {
  date_desc: "חדש → ישן",
  date_asc: "ישן → חדש",
  name: "לפי שם (א׳-ת׳)",
  type: "לפי סוג",
};

const GROUP_LABEL: Record<GroupFilter, string> = {
  all: "הכל",
  document: "מסמכים שיצרתי",
  diagram: "תרשימים",
  upload: "קבצים שהעליתי",
};

function formatSize(bytes?: number | null) {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function DocumentsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const listSpecsFn = useServerFn(listSpecs);
  const listDiagramsFn = useServerFn(listDiagrams);
  const listDocumentsFn = useServerFn(listDocuments);
  const deleteSpecFn = useServerFn(deleteSpec);
  const deleteDiagramFn = useServerFn(deleteDiagram);
  const deleteDocumentFn = useServerFn(deleteDocument);
  const updateSpecFn = useServerFn(updateSpec);
  const updateDiagramFn = useServerFn(updateDiagram);
  const renameDocumentFn = useServerFn(renameDocument);

  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<GroupFilter>("all");
  const [typeFilter, setTypeFilter] = useState<OutputKey | "all">("all");
  const [sortBy, setSortBy] = useState<SortKey>("date_desc");
  const [filterOpen, setFilterOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);
  const [renameTarget, setRenameTarget] = useState<Item | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Column widths (Windows Explorer-like resizable columns).
  // `name` is the flex column (1fr); others are pixel widths.
  const COL_STORAGE_KEY = "documents-col-widths-v1";
  const DEFAULT_COLS = { type: 140, date: 120, size: 90, actions: 80 };
  type ColKey = keyof typeof DEFAULT_COLS;
  const [cols, setCols] = useState<typeof DEFAULT_COLS>(() => {
    if (typeof window === "undefined") return DEFAULT_COLS;
    try {
      const raw = localStorage.getItem(COL_STORAGE_KEY);
      if (raw) return { ...DEFAULT_COLS, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return DEFAULT_COLS;
  });
  useEffect(() => {
    try { localStorage.setItem(COL_STORAGE_KEY, JSON.stringify(cols)); } catch { /* ignore */ }
  }, [cols]);

  const gridTemplate = `minmax(160px,1fr) ${cols.type}px ${cols.date}px ${cols.size}px ${cols.actions}px`;

  const dragRef = useRef<{ key: ColKey; startX: number; startW: number } | null>(null);
  const startResize = useCallback((key: ColKey) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { key, startX: e.clientX, startW: cols[key] };
    const onMove = (ev: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      // Even in RTL, resizing should follow the pointer direction:
      // dragging right increases width, dragging left decreases it.
      const delta = ev.clientX - d.startX;
      const next = Math.max(60, Math.min(600, d.startW + delta));
      setCols((c) => ({ ...c, [d.key]: next }));
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [cols]);


  const { data: specsData, isLoading: specsLoading } = useQuery({
    queryKey: ["specs-all"],
    queryFn: () => listSpecsFn(),
  });
  const { data: diagramsData, isLoading: diagramsLoading } = useQuery({
    queryKey: ["diagrams-all"],
    queryFn: () => listDiagramsFn(),
  });
  const { data: uploadsData, isLoading: uploadsLoading } = useQuery({
    queryKey: ["uploaded-documents", "all"],
    queryFn: () => listDocumentsFn({ data: {} }),
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
    const uploads: Item[] =
      (uploadsData?.documents ?? []).map((u) => ({
        id: u.id,
        title: u.file_name,
        type: "upload",
        category: "upload",
        createdAt: u.created_at,
        prompt: "",
        meta: formatSize(u.file_size),
      })) ?? [];
    return [...specs, ...diagrams, ...uploads];
  }, [specsData, diagramsData, uploadsData]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = items.filter((it) => {
      if (group !== "all" && it.category !== group) return false;
      if (typeFilter !== "all" && it.type !== typeFilter) return false;
      if (!q) return true;
      return (
        it.title.toLowerCase().includes(q) ||
        it.prompt.toLowerCase().includes(q)
      );
    });
    out.sort((a, b) => {
      switch (sortBy) {
        case "date_asc":
          return a.createdAt < b.createdAt ? -1 : 1;
        case "name":
          return a.title.localeCompare(b.title, "he");
        case "type":
          return a.category.localeCompare(b.category) ||
            String(a.type).localeCompare(String(b.type));
        case "date_desc":
        default:
          return a.createdAt < b.createdAt ? 1 : -1;
      }
    });
    return out;
  }, [items, query, group, typeFilter, sortBy]);

  const deleteMut = useMutation({
    mutationFn: async (item: Item) => {
      if (item.category === "document") {
        await deleteSpecFn({ data: { id: item.id } });
      } else if (item.category === "diagram") {
        await deleteDiagramFn({ data: { id: item.id } });
      } else {
        await deleteDocumentFn({ data: { id: item.id } });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["specs-all"] });
      qc.invalidateQueries({ queryKey: ["diagrams-all"] });
      qc.invalidateQueries({ queryKey: ["uploaded-documents", "all"] });
      setDeleteTarget(null);
      toast.success("נמחק");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "מחיקה נכשלה"),
  });

  const renameMut = useMutation({
    mutationFn: async ({ item, title }: { item: Item; title: string }) => {
      const t = title.trim();
      if (!t) throw new Error("שם לא יכול להיות ריק");
      if (item.category === "document") {
        await updateSpecFn({ data: { id: item.id, title: t } });
      } else if (item.category === "diagram") {
        await updateDiagramFn({ data: { id: item.id, title: t } });
      } else {
        await renameDocumentFn({ data: { id: item.id, file_name: t } });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["specs-all"] });
      qc.invalidateQueries({ queryKey: ["diagrams-all"] });
      qc.invalidateQueries({ queryKey: ["uploaded-documents", "all"] });
      setRenameTarget(null);
      setRenameValue("");
      toast.success("שונה השם");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שינוי השם נכשל"),
  });

  const isLoading = specsLoading || diagramsLoading || uploadsLoading;
  const activeFilterCount =
    (group !== "all" ? 1 : 0) + (typeFilter !== "all" ? 1 : 0);

  // Sub-types available in the currently selected group
  const subTypeKeys = useMemo<OutputKey[]>(() => {
    if (group === "upload") return [];
    return OUTPUT_TYPE_ORDER.filter((k) => {
      const cat = OUTPUT_TYPES[k].category;
      if (group === "all") return true;
      return cat === group;
    });
  }, [group]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          המסמכים שלי
        </h1>
      </div>

      {/* Toolbar: search + sort + filter */}
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חפש לפי שם או פרומפט..."
            className="h-10 pr-9"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              aria-label="מיון"
              title={`מיון: ${SORT_LABEL[sortBy]}`}
            >
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>מיון</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
              <DropdownMenuItem
                key={k}
                onClick={() => setSortBy(k)}
                className="flex items-center justify-between gap-3"
              >
                <span>{SORT_LABEL[k]}</span>
                {sortBy === k && <Check className="h-3.5 w-3.5" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="relative h-10 w-10 shrink-0"
              aria-label="סינון"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="text-right">סינון</SheetTitle>
            </SheetHeader>

            <div className="mt-4 space-y-5">
              <div>
                <div className="mb-2 text-xs font-medium text-muted-foreground">
                  קטגוריה
                </div>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(GROUP_LABEL) as GroupFilter[]).map((g) => {
                    const active = group === g;
                    return (
                      <button
                        key={g}
                        onClick={() => {
                          setGroup(g);
                          setTypeFilter("all");
                        }}
                        className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card hover:bg-accent"
                        }`}
                      >
                        {GROUP_LABEL[g]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {subTypeKeys.length > 0 && (
                <div>
                  <div className="mb-2 text-xs font-medium text-muted-foreground">
                    סוג
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setTypeFilter("all")}
                      className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                        typeFilter === "all"
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card hover:bg-accent"
                      }`}
                    >
                      כל הסוגים
                    </button>
                    {subTypeKeys.map((key) => {
                      const t = OUTPUT_TYPES[key];
                      const active = typeFilter === key;
                      return (
                        <button
                          key={key}
                          onClick={() => setTypeFilter(key)}
                          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-card hover:bg-accent"
                          }`}
                        >
                          <t.icon
                            className={`h-3 w-3 ${active ? "" : t.colorClass}`}
                          />
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <SheetFooter className="mt-6 flex-row justify-between gap-2 sm:justify-between">
              <Button
                variant="ghost"
                onClick={() => {
                  setGroup("all");
                  setTypeFilter("all");
                }}
                disabled={activeFilterCount === 0}
              >
                <X className="ml-1 h-4 w-4" />
                נקה הכל
              </Button>
              <Button onClick={() => setFilterOpen(false)} className="btn-gradient border-0">
                הצג תוצאות
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {/* Active filter chips summary */}
      {activeFilterCount > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          {group !== "all" && (
            <Badge variant="secondary" className="gap-1 pr-2">
              {GROUP_LABEL[group]}
              <button
                onClick={() => {
                  setGroup("all");
                  setTypeFilter("all");
                }}
                aria-label="הסר"
                className="ml-0.5 rounded-full hover:bg-muted-foreground/20"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {typeFilter !== "all" && (
            <Badge variant="secondary" className="gap-1 pr-2">
              {OUTPUT_TYPES[typeFilter]?.label}
              <button
                onClick={() => setTypeFilter("all")}
                aria-label="הסר"
                className="ml-0.5 rounded-full hover:bg-muted-foreground/20"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}

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
              : "נסה/י מילת חיפוש או סינון אחר."
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
        <div className="rounded-md border border-border bg-card [direction:rtl]">
          {/* Explorer header */}
          <div
            className="grid items-center gap-2 border-b border-border bg-muted/40 px-3 py-2 text-[11px] font-medium text-muted-foreground"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            <div className="truncate">שם</div>
            <div className="relative truncate">
              <span
                onMouseDown={startResize("type")}
                className="absolute -left-2 top-0 z-10 h-full w-3 cursor-col-resize select-none bg-border/60 hover:bg-primary"
                aria-hidden
              />
              סוג
            </div>
            <div className="relative truncate">
              <span
                onMouseDown={startResize("date")}
                className="absolute -left-2 top-0 z-10 h-full w-3 cursor-col-resize select-none bg-border/60 hover:bg-primary"
                aria-hidden
              />
              תאריך
            </div>
            <div className="relative truncate">
              <span
                onMouseDown={startResize("size")}
                className="absolute -left-2 top-0 z-10 h-full w-3 cursor-col-resize select-none bg-border/60 hover:bg-primary"
                aria-hidden
              />
              גודל
            </div>
            <div className="relative truncate text-left">
              <span
                onMouseDown={startResize("actions")}
                className="absolute -left-2 top-0 z-10 h-full w-3 cursor-col-resize select-none bg-border/60 hover:bg-primary"
                aria-hidden
              />
              פעולות
            </div>
          </div>


          <ul className="divide-y divide-border">
            {filtered.map((it) => {
              const def = it.category !== "upload" ? OUTPUT_TYPES[it.type as OutputKey] : null;
              const Icon =
                it.category === "upload"
                  ? FileUp
                  : def?.icon ?? (it.category === "diagram" ? GitBranch : FileText);
              const colorClass =
                it.category === "upload" ? "text-teal-500" : def?.colorClass ?? "";
              const typeLabel =
                it.category === "upload" ? "קובץ שהועלה" : def?.label ?? "";

              const openTo =
                it.category === "document"
                  ? { to: "/editor/$id" as const, params: { id: it.id } }
                  : it.category === "diagram"
                    ? { to: "/diagram/$id" as const, params: { id: it.id } }
                    : null;

              const RowInner = (
                <>
                  <div className="flex min-w-0 items-center gap-2">
                    <Icon className={`h-4 w-4 shrink-0 ${colorClass}`} />
                    <span className="truncate text-sm text-foreground">
                      {it.title}
                    </span>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {typeLabel}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {new Date(it.createdAt).toLocaleDateString("he-IL")}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {it.meta ?? "—"}
                  </div>
                </>
              );

              return (
                <li
                  key={`${it.category}-${it.id}`}
                  className="group grid items-center gap-2 px-3 py-1.5 hover:bg-accent/60"
                  style={{ gridTemplateColumns: gridTemplate }}
                >
                  {openTo ? (
                    <Link
                      to={openTo.to}
                      params={openTo.params}
                      className="contents"
                    >
                      {RowInner}
                    </Link>
                  ) : (
                    <div className="contents">{RowInner}</div>
                  )}
                  <div className="flex items-center justify-start gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {openTo && (
                      <Link
                        to={openTo.to}
                        params={openTo.params}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
                        aria-label="פתח"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setRenameTarget(it);
                        setRenameValue(it.title);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                      aria-label="שנה שם"
                      title="שנה שם"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(it)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-destructive"
                      aria-label="מחק"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>

              );
            })}
          </ul>
        </div>
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

      <AlertDialog
        open={!!renameTarget}
        onOpenChange={(o) => {
          if (!o) {
            setRenameTarget(null);
            setRenameValue("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right">שינוי שם</AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              הזן שם חדש למסמך.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <Input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (
                    renameTarget &&
                    renameValue.trim() &&
                    renameValue.trim() !== renameTarget.title &&
                    !renameMut.isPending
                  ) {
                    renameMut.mutate({ item: renameTarget, title: renameValue });
                  }
                }
              }}
              maxLength={255}
              className="text-right"
              dir="auto"
            />
            <AlertDialogFooter>
              <AlertDialogCancel type="button">ביטול</AlertDialogCancel>
              <AlertDialogAction
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  if (renameTarget) {
                    renameMut.mutate({ item: renameTarget, title: renameValue });
                  }
                }}
                disabled={
                  renameMut.isPending ||
                  !renameValue.trim() ||
                  renameValue.trim() === renameTarget?.title
                }
              >
                {renameMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "שמור"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>

  );
}
