// ============================================================
// src/components/settings/agent-personas-card.tsx
// רכיב UI — agent-personas-card
// ============================================================
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Bot, MessagesSquare } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  listAgentPersonas,
  deleteAgentPersona,
} from "@/lib/agents/agents.functions";
import { AgentPersonaDialog, type PersonaDraft } from "./agent-persona-dialog";

export function AgentPersonasCard() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAgentPersonas);
  const deleteFn = useServerFn(deleteAgentPersona);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PersonaDraft | null>(null);
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["agent-personas"],
    queryFn: () => listFn(),
  });

  const del = useMutation({
    mutationFn: async (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-personas"] });
      toast.success("נמחק");
      setToDelete(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "מחיקה נכשלה"),
  });

  function startNew() {
    setEditing(null);
    setDialogOpen(true);
  }

  function startEdit(p: any) {
    setEditing({
      id: p.id,
      name: p.name,
      org_id: p.org_id,
      role_title: p.role_title ?? "",
      role_description: p.role_description ?? "",
      knowledge: p.knowledge ?? "",
      tools: Array.isArray(p.tools) ? p.tools : [],
      color: p.color ?? "#6366f1",
    });
    setDialogOpen(true);
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-muted-foreground">
            הגדרת סוכני AI שיוכלו להשתתף בשיחות מתוזמרות.
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/agent-conversations">
                <MessagesSquare className="h-4 w-4 ml-1" />
                שיחות
              </Link>
            </Button>
            <Button size="sm" onClick={startNew}>
              <Plus className="h-4 w-4 ml-1" />
              הקמת משתמש מערכת
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !data?.personas.length ? (
          <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            עוד לא הוקמו משתמשי מערכת. לחץ "הקמת משתמש מערכת" כדי להתחיל.
          </div>
        ) : (
          <ul className="space-y-2">
            {data.personas.map((p: any) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-md border border-border p-3"
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: p.color }}
                >
                  <Bot className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {p.role_title || "ללא תפקיד"}
                    {p.organizations?.name ? ` · ${p.organizations.name}` : ""}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => startEdit(p)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setToDelete({ id: p.id, name: p.name })}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <AgentPersonaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>למחוק את "{toDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              הפעולה תמחק את משתמש המערכת. שיחות קיימות יישארו אך ההודעות שלו לא יהיו משויכות.
            </AlertDialogDescription>
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
    </Card>
  );
}
