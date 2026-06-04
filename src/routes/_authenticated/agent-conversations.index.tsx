import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Plus, MessagesSquare, Trash2, ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { AppBreadcrumb } from "@/components/app-breadcrumb";
import { AgentPersonasCard } from "@/components/agent-personas-card";
import { useSiteTexts } from "@/lib/site-texts-context";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import {
  listAgentConversations,
  listAgentPersonas,
  createAgentConversation,
  deleteAgentConversation,
  suggestConversationField,
} from "@/lib/agents.functions";

export const Route = createFileRoute("/_authenticated/agent-conversations/")({
  head: () => ({ meta: [{ title: "שיחות סוכנים" }] }),
  component: AgentConversationsPage,
});

function AgentConversationsPage() {
  const { isAdmin } = useSiteTexts();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const listConvs = useServerFn(listAgentConversations);
  const listPers = useServerFn(listAgentPersonas);
  const createFn = useServerFn(createAgentConversation);
  const deleteFn = useServerFn(deleteAgentConversation);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [toDelete, setToDelete] = useState<{ id: string; title: string } | null>(null);

  const { data: convs, isLoading } = useQuery({
    queryKey: ["agent-conversations"],
    queryFn: () => listConvs(),
    enabled: isAdmin,
  });

  const { data: personas } = useQuery({
    queryKey: ["agent-personas"],
    queryFn: () => listPers(),
    enabled: isAdmin && open,
  });

  const create = useMutation({
    mutationFn: async () =>
      createFn({
        data: {
          title: title.trim(),
          topic: topic.trim(),
          persona_ids: selected,
        },
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["agent-conversations"] });
      setOpen(false);
      setTitle("");
      setTopic("");
      setSelected([]);
      navigate({ to: "/agent-conversations/$id", params: { id: res.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "יצירה נכשלה"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => deleteFn({ data: { conversationId: id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-conversations"] });
      setToDelete(null);
      toast.success("נמחק");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "מחיקה נכשלה"),
  });

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-center text-sm text-muted-foreground">
        רק אדמין יכול לגשת לעמוד זה.
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 space-y-6">
      <AppBreadcrumb items={[{ label: "הגדרות", to: "/settings" }, { label: "שיחות סוכנים" }]} />

      <section className="space-y-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">משתמשי מערכת (סוכני AI)</h2>
          <p className="text-xs text-muted-foreground">
            הקמה וניהול של סוכני AI עם פרסונה, ידע וכלים.
          </p>
        </div>
        <AgentPersonasCard />
      </section>

      <div className="flex items-center justify-between pt-4">
        <h1 className="text-2xl font-semibold tracking-tight">שיחות סוכנים</h1>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 ml-1" />
          שיחה חדשה
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !convs?.conversations.length ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            אין שיחות עדיין. לחץ "שיחה חדשה" כדי להתחיל.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {convs.conversations.map((c: any) => (
            <li key={c.id} className="flex items-center gap-3 rounded-md border border-border bg-card p-3">
              <MessagesSquare className="h-5 w-5 text-muted-foreground shrink-0" />
              <Link
                to="/agent-conversations/$id"
                params={{ id: c.id }}
                className="flex-1 min-w-0"
              >
                <div className="text-sm font-medium truncate">{c.title}</div>
                {c.topic ? (
                  <div className="text-xs text-muted-foreground truncate">{c.topic}</div>
                ) : null}
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setToDelete({ id: c.id, title: c.title })}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}




      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>שיחה חדשה</DialogTitle>
            <DialogDescription>בחר את המשתתפים ותן כותרת לשיחה.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>כותרת *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
            </div>
            <div className="space-y-1.5">
              <Label>נושא הפתיחה (יישלח כהודעת מנחה ראשונה)</Label>
              <Textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                rows={3}
                maxLength={5000}
                placeholder="מה אנחנו רוצים שיידונו?"
              />
            </div>
            <div className="space-y-2">
              <Label>משתתפים *</Label>
              {!personas?.personas.length ? (
                <div className="text-xs text-muted-foreground">
                  אין משתמשי מערכת עדיין. צור אותם בדף ההגדרות.
                </div>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto rounded-md border border-border p-2">
                  {personas.personas.map((p: any) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-2 rounded p-1.5 hover:bg-accent cursor-pointer"
                    >
                      <Checkbox
                        checked={selected.includes(p.id)}
                        onCheckedChange={() =>
                          setSelected((s) =>
                            s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id],
                          )
                        }
                      />
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: p.color }}
                      />
                      <span className="text-sm">{p.name}</span>
                      {p.role_title ? (
                        <span className="text-xs text-muted-foreground">— {p.role_title}</span>
                      ) : null}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>ביטול</Button>
            <Button
              onClick={() => create.mutate()}
              disabled={create.isPending || !title.trim() || selected.length === 0}
            >
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              יצירה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>למחוק את השיחה "{toDelete?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>כל ההודעות יימחקו. לא ניתן לשחזר.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toDelete && del.mutate(toDelete.id)}
              disabled={del.isPending}
            >
              מחיקה
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
