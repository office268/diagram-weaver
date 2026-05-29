import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { FileText, Trash2, Loader2, Sparkles } from "lucide-react";
import {
  listSpecs,
  createSpec,
  deleteSpec,
} from "@/lib/spec.functions";
import { generateSpecFromPrompt } from "@/lib/ai-spec.functions";
import { Button } from "@/components/ui/button";
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

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "המסמכים שלי — סוכן ניתוח מערכות" },
      {
        name: "description",
        content: "כל מסמכי האפיון על שלך במקום אחד — צרו חדש מתוך תיאור חופשי של המערכת.",
      },
      { property: "og:title", content: "המסמכים שלי — סוכן ניתוח מערכות" },
      { property: "og:url", content: "/dashboard" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listFn = useServerFn(listSpecs);
  const createFn = useServerFn(createSpec);
  const deleteFn = useServerFn(deleteSpec);
  const genFn = useServerFn(generateSpecFromPrompt);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [prompt, setPrompt] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["specs"],
    queryFn: () => listFn(),
  });

  const generateMut = useMutation({
    mutationFn: async () => {
      const spec = await genFn({ data: { prompt } });
      const { spec: row } = await createFn({
        data: { title: spec.title, prompt, content: spec },
      });
      return row;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["specs"] });
      setNewOpen(false);
      setPrompt("");
      navigate({ to: "/editor/$id", params: { id: row.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "יצירה נכשלה"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["specs"] });
      toast.success("המסמך נמחק");
      setDeleteId(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "מחיקה נכשלה"),
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            מסמכי האפיון שלי
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            תארו מערכת בחופשי — קבלו מסמך אפיון על מלא וערוך.
          </p>
        </div>
        <Button onClick={() => setNewOpen(true)} className="w-full sm:w-auto">
          <Sparkles className="mr-2 h-4 w-4" />
          מסמך אפיון חדש
        </Button>
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
        ) : !data?.specs.length ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
            <h3 className="mt-4 font-medium text-foreground">עדיין אין מסמכים</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              לחצו על "מסמך אפיון חדש" כדי להתחיל.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.specs.map((d) => (
              <li
                key={d.id}
                className="group relative flex flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <Link to="/editor/$id" params={{ id: d.id }} className="flex-1">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="truncate font-medium text-foreground">
                      {d.title}
                    </span>
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">
                    עודכן ב-{new Date(d.updated_at).toLocaleDateString("he-IL")}
                  </div>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-2 h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
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

      <Dialog open={newOpen} onOpenChange={(o) => !generateMut.isPending && setNewOpen(o)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              מסמך אפיון חדש
            </DialogTitle>
            <DialogDescription>
              תארו את המערכת במילים שלכם — הסוכן יבנה דרישות, הנחות יסוד, ארכיטקטורה, מודל נתונים, תרחישים ועוד.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="spec-prompt">תיאור המערכת</Label>
            <Textarea
              id="spec-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="למשל: מערכת לניהול הזמנות במסעדה הכוללת אפליקציה למלצרים, ממשק למטבח, ודשבורד למנהל..."
              rows={7}
              maxLength={5000}
              autoFocus
            />
            <div className="text-left text-xs text-muted-foreground" dir="ltr">
              {prompt.length} / 5000
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewOpen(false)} disabled={generateMut.isPending}>
              ביטול
            </Button>
            <Button
              onClick={() => generateMut.mutate()}
              disabled={prompt.trim().length < 5 || generateMut.isPending}
            >
              {generateMut.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  בונה את המסמך…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  צור מסמך
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>למחוק את המסמך?</AlertDialogTitle>
            <AlertDialogDescription>
              לא ניתן לבטל פעולה זו.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMut.mutate(deleteId)}
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
