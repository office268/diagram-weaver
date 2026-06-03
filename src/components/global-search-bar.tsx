import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  X,
  Check,
  FileText,
  GitBranch,
  FileUp,
  Folder,
  Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import { Package } from "lucide-react";
import { ProductsBrowserSheet } from "@/components/products-browser-sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { listSpecs } from "@/lib/spec.functions";
import { listDiagrams } from "@/lib/diagrams.functions";
import { listDocuments } from "@/lib/documents.functions";
import { listProjects } from "@/lib/project.functions";

type Category = "project" | "document" | "diagram" | "upload";
type GroupFilter = "all" | Category;
type SortKey = "date_desc" | "date_asc" | "name" | "type";

type Item = {
  id: string;
  title: string;
  category: Category;
  createdAt: string;
  meta?: string;
};

const SORT_LABEL: Record<SortKey, string> = {
  date_desc: "חדש → ישן",
  date_asc: "ישן → חדש",
  name: "לפי שם (א׳-ת׳)",
  type: "לפי סוג",
};

const GROUP_LABEL: Record<GroupFilter, string> = {
  all: "הכל",
  project: "פרויקטים",
  document: "מסמכים",
  diagram: "תרשימים",
  upload: "קבצים שהעליתי",
};

const CATEGORY_LABEL: Record<Category, string> = {
  project: "פרויקט",
  document: "מסמך",
  diagram: "תרשים",
  upload: "קובץ",
};

const CATEGORY_ICON: Record<Category, typeof FileText> = {
  project: Folder,
  document: FileText,
  diagram: GitBranch,
  upload: FileUp,
};

const CATEGORY_COLOR: Record<Category, string> = {
  project: "text-amber-500",
  document: "text-blue-500",
  diagram: "text-violet-500",
  upload: "text-teal-500",
};

export function GlobalSearchBar({ onNavigate }: { onNavigate?: () => void }) {
  const listSpecsFn = useServerFn(listSpecs);
  const listDiagramsFn = useServerFn(listDiagrams);
  const listDocumentsFn = useServerFn(listDocuments);
  const listProjectsFn = useServerFn(listProjects);

  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<GroupFilter>("all");
  const [sortBy, setSortBy] = useState<SortKey>("date_desc");
  const [filterOpen, setFilterOpen] = useState(false);

  const { data: specsData, isLoading: l1 } = useQuery({
    queryKey: ["specs-all"],
    queryFn: () => listSpecsFn(),
  });
  const { data: diagramsData, isLoading: l2 } = useQuery({
    queryKey: ["diagrams-all"],
    queryFn: () => listDiagramsFn(),
  });
  const { data: uploadsData, isLoading: l3 } = useQuery({
    queryKey: ["uploaded-documents", "all"],
    queryFn: () => listDocumentsFn({ data: {} }),
  });
  const { data: projectsData, isLoading: l4 } = useQuery({
    queryKey: ["projects"],
    queryFn: () => listProjectsFn(),
  });

  const isLoading = l1 || l2 || l3 || l4;

  const items: Item[] = useMemo(() => {
    const out: Item[] = [];
    for (const p of projectsData?.projects ?? []) {
      out.push({
        id: p.id,
        title: p.name,
        category: "project",
        createdAt: p.created_at,
      });
    }
    for (const s of specsData?.specs ?? []) {
      out.push({
        id: s.id,
        title: s.title,
        category: "document",
        createdAt: s.created_at,
      });
    }
    for (const d of diagramsData?.diagrams ?? []) {
      out.push({
        id: d.id,
        title: d.title,
        category: "diagram",
        createdAt: d.created_at,
      });
    }
    for (const u of uploadsData?.documents ?? []) {
      out.push({
        id: u.id,
        title: u.file_name,
        category: "upload",
        createdAt: u.created_at,
      });
    }
    return out;
  }, [specsData, diagramsData, uploadsData, projectsData]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = items.filter((it) => {
      if (group !== "all" && it.category !== group) return false;
      if (!q) return true;
      return it.title.toLowerCase().includes(q);
    });
    out.sort((a, b) => {
      switch (sortBy) {
        case "date_asc":
          return a.createdAt < b.createdAt ? -1 : 1;
        case "name":
          return a.title.localeCompare(b.title, "he");
        case "type":
          return a.category.localeCompare(b.category);
        case "date_desc":
        default:
          return a.createdAt < b.createdAt ? 1 : -1;
      }
    });
    return out.slice(0, 30);
  }, [items, query, group, sortBy]);

  const activeFilterCount = group !== "all" ? 1 : 0;
  const hasQueryOrFilter = query.trim().length > 0 || group !== "all";

  return (
    <div className="border-t border-border bg-card px-4 py-3 [direction:rtl]">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חפש פרויקטים, מסמכים, תרשימים, קבצים..."
            className="h-10 pr-9"
            autoFocus
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
                        onClick={() => setGroup(g)}
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
            </div>
            <SheetFooter className="mt-6 flex-row justify-between gap-2 sm:justify-between">
              <Button
                variant="ghost"
                onClick={() => setGroup("all")}
                disabled={activeFilterCount === 0}
              >
                <X className="ml-1 h-4 w-4" />
                נקה הכל
              </Button>
              <Button
                onClick={() => setFilterOpen(false)}
                className="btn-gradient border-0"
              >
                הצג תוצאות
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {group !== "all" && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="secondary" className="gap-1 pr-2">
            {GROUP_LABEL[group]}
            <button
              onClick={() => setGroup("all")}
              aria-label="הסר"
              className="ml-0.5 rounded-full hover:bg-muted-foreground/20"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        </div>
      )}

      {hasQueryOrFilter && (
        <div className="mt-3 max-h-[60vh] overflow-y-auto rounded-md border border-border bg-background">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              לא נמצאו תוצאות
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((it) => {
                const Icon = CATEGORY_ICON[it.category];
                const inner = (
                  <div className="flex items-start gap-2 px-3 py-2 hover:bg-accent">
                    <div
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent ${CATEGORY_COLOR[it.category]}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">
                        {it.title}
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {CATEGORY_LABEL[it.category]} ·{" "}
                        {new Date(it.createdAt).toLocaleDateString("he-IL")}
                      </div>
                    </div>
                  </div>
                );
                return (
                  <li key={`${it.category}-${it.id}`}>
                    {it.category === "project" ? (
                      <Link
                        to="/projects/$projectId"
                        params={{ projectId: it.id }}
                        onClick={() => onNavigate?.()}
                        className="block"
                      >
                        {inner}
                      </Link>
                    ) : it.category === "document" ? (
                      <Link
                        to="/editor/$id"
                        params={{ id: it.id }}
                        onClick={() => onNavigate?.()}
                        className="block"
                      >
                        {inner}
                      </Link>
                    ) : (
                      <Link
                        to="/documents"
                        onClick={() => onNavigate?.()}
                        className="block"
                      >
                        {inner}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
