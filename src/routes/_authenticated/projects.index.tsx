import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { FolderPlus, Folder, Trash2, Loader2, FileText, Layers, Search, Pin, PinOff } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { SwipeableRow } from "@/components/swipeable-row";
import { PullToRefreshIndicator } from "@/components/pull-to-refresh-indicator";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";

import {
  listProjects,
  createProject,
  deleteProject,
  toggleProjectPin,
} from "@/lib/project.functions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export const Route = createFileRoute("/_authenticated/projects/")({
  head: () => ({
    meta: [
      { title: "הפרויקטים שלי — סוכן ניתוח מערכות" },
      {
        name: "description",
        content: "ניהול הפרויקטים שלך — לכל פרויקט מסמכים מסוגים שונים.",
      },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const listFn = useServerFn(listProjects);
  const createFn = useServerFn(createProject);
  const deleteFn = useServerFn(deleteProject);
  const pinFn = useServerFn(toggleProjectPin);


  const [newOpen, setNewOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["projects"],
    queryFn: () => listFn(),
  });

  const pullToRefresh = usePullToRefresh({
    onRefresh: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });

  const createMut = useMutation({
    mutationFn: () => createFn({ data: { name: name.trim(), description: description.trim() } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      setNewOpen(false);
      setName("");
      setDescription("");
      toast.success("הפרויקט נוצר");
      navigate({ to: "/projects/$projectId", params: { projectId: res.project.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "יצירה נכשלה"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      setDeleteId(null);
      toast.success("הפרויקט נמחק");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "מחיקה נכשלה"),
  });

  const pinMut = useMutation({
    mutationFn: (vars: { id: string; pinned: boolean }) =>
      pinFn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["recent-items"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "פעולה נכשלה"),
  });


  return (
    <div
      className="relative mx-auto w-full max-w-6xl px-4 py-8"
      onTouchStart={pullToRefresh.bind.onTouchStart}
      onTouchMove={pullToRefresh.bind.onTouchMove}
      onTouchEnd={pullToRefresh.bind.onTouchEnd}
    >
      <PullToRefreshIndicator
        pullDistance={pullToRefresh.pullDistance}
        refreshing={pullToRefresh.refreshing}
        threshold={pullToRefresh.threshold}
      />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">הפרויקטים שלי</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            כל פרויקט מאגד את כל סוגי המסמכים והגרסאות שלו.
          </p>
        </div>
        <Button onClick={() => setNewOpen(true)} className="btn-gradient w-full border-0 sm:w-auto">
          <FolderPlus className="mr-2 h-4 w-4" />
          פרויקט חדש
        </Button>

      </div>

      <div className="mt-6">
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חפש לפי שם או תיאור הפרויקט..."
            className="pr-9"
          />
        </div>
        {isLoading ? (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start gap-2">
                  <Skeleton className="h-5 w-5 shrink-0 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="mr-auto h-3 w-20" />
                </div>
              </li>
            ))}
          </ul>
        ) : error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {(error as Error).message}
          </div>
        ) : !data?.projects.length ? (
          <EmptyState
            icon={Folder}
            title="עדיין אין פרויקטים"
            description='לחצו על "פרויקט חדש" כדי להתחיל לבנות את מסמכי האפיון הראשונים שלכם.'
            action={
              <Button onClick={() => setNewOpen(true)} className="btn-gradient border-0">
                <FolderPlus className="mr-2 h-4 w-4" />
                צרו פרויקט ראשון
              </Button>
            }
          />
        ) : (() => {
          const q = query.trim().toLowerCase();
          const filtered = q
            ? data.projects.filter(
                (p) =>
                  p.name.toLowerCase().includes(q) ||
                  (p.description ?? "").toLowerCase().includes(q),
              )
            : data.projects;
          if (filtered.length === 0) {
            return (
              <EmptyState
                icon={Search}
                title="לא נמצאו פרויקטים"
                description="נסו מילת חיפוש אחרת או נקו את שדה החיפוש."
              />
            );
          }

          type ProjectItem = (typeof filtered)[number];
          const pinned = filtered.filter((p) => p.pinned_at);
          const others = filtered.filter((p) => !p.pinned_at);

          const renderCard = (p: ProjectItem, i: number) => {
            const isPinned = !!p.pinned_at;
            return (
              <li
                key={p.id}
                className="group hover-lift animate-fade-in relative rounded-xl border border-border bg-card"
                style={i < 12 ? { animationDelay: `${i * 40}ms`, animationFillMode: "backwards" } : undefined}
              >
                <SwipeableRow onDelete={() => setDeleteId(p.id)} className="rounded-xl">
                  <div className="p-4">
                <Link
                  to="/projects/$projectId"
                  params={{ projectId: p.id }}
                  className="block"
                >
                  <div className="flex items-start gap-2">
                    <Folder className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <div className="truncate font-medium text-foreground">{p.name}</div>
                        {isPinned && (
                          <Pin className="h-3 w-3 shrink-0 fill-primary text-primary" />
                        )}
                      </div>
                      {p.description && (
                        <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {p.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Layers className="h-3.5 w-3.5" />
                      {p.group_count} קבוצות
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" />
                      {p.doc_count} מסמכים
                    </span>
                    <span className="mr-auto">
                      {new Date(p.updated_at).toLocaleDateString("he-IL")}
                    </span>
                  </div>
                </Link>
                <div className="absolute left-2 top-2 flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title={isPinned ? "בטל הצמדה" : "הצמד לראש"}
                    onClick={(e) => {
                      e.preventDefault();
                      pinMut.mutate({ id: p.id, pinned: !isPinned });
                    }}
                  >
                    {isPinned ? (
                      <PinOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Pin className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.preventDefault();
                      setDeleteId(p.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  </div>
                </SwipeableRow>
              </li>
            );
          };

          return (
            <div className="space-y-8">
              {pinned.length > 0 && (
                <section>
                  <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                    <Pin className="h-3.5 w-3.5 text-primary" />
                    מוצמדים
                  </h2>
                  <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {pinned.map(renderCard)}
                  </ul>
                </section>
              )}
              {others.length > 0 && (
                <section>
                  {pinned.length > 0 && (
                    <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
                      כל הפרויקטים
                    </h2>
                  )}
                  <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {others.map(renderCard)}
                  </ul>
                </section>
              )}
            </div>
          );

        })()}
      </div>


      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>פרויקט חדש</DialogTitle>
            <DialogDescription>
              תנו לפרויקט שם — תוכלו ליצור תחתיו מסמכים מסוגים שונים.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="proj-name">שם הפרויקט</Label>
              <Input
                id="proj-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="למשל: מערכת ניהול הזמנות"
                maxLength={200}
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="proj-desc">תיאור (אופציונלי)</Label>
              <Textarea
                id="proj-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={2000}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewOpen(false)}>
              ביטול
            </Button>
            <Button
              onClick={() => createMut.mutate()}
              disabled={name.trim().length < 1 || createMut.isPending}
            >
              {createMut.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FolderPlus className="mr-2 h-4 w-4" />
              )}
              צור פרויקט
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>למחוק את הפרויקט?</AlertDialogTitle>
            <AlertDialogDescription>
              כל המסמכים והגרסאות תחת הפרויקט יימחקו לצמיתות. לא ניתן לבטל פעולה זו.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMut.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              מחק פרויקט
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
