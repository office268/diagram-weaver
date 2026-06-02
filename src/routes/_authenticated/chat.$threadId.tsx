import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Send,
  FileText,
  GitBranch,
  Copy,
  ExternalLink,
  Trash2,
  ArrowRight,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { supabase } from "@/integrations/supabase/client";
import {
  getChatThread,
  listChatThreads,
  deleteChatThread,
} from "@/lib/chat.functions";
import { OUTPUT_TYPES, type OutputKey } from "@/lib/output-types";
import { MermaidPreview } from "@/components/mermaid-preview";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  head: () => ({ meta: [{ title: "שיחה — סוכן ניתוח מערכות" }] }),
  component: ChatPage,
});

function ChatPage() {
  const { threadId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getThreadFn = useServerFn(getChatThread);
  const listThreadsFn = useServerFn(listChatThreads);
  const deleteThreadFn = useServerFn(deleteChatThread);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["chat-thread", threadId],
    queryFn: () => getThreadFn({ data: { threadId } }),
  });

  const { data: threadsData } = useQuery({
    queryKey: ["chat-threads"],
    queryFn: () => listThreadsFn(),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteThreadFn({ data: { threadId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-threads"] });
      toast.success("השיחה נמחקה");
      navigate({ to: "/dashboard" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "מחיקה נכשלה"),
  });

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [data?.messages, sending]);

  // Focus composer
  useEffect(() => {
    textareaRef.current?.focus();
  }, [threadId, sending]);

  async function handleSend() {
    const msg = input.trim();
    if (!msg || sending) return;
    setSending(true);
    setInput("");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("נדרשת התחברות מחדש");
      const res = await fetch("/api/chat-message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ threadId, message: msg }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `שגיאה ${res.status}`);
      }
      await qc.invalidateQueries({ queryKey: ["chat-thread", threadId] });
      await qc.invalidateQueries({ queryKey: ["chat-threads"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "שליחה נכשלה");
      setInput(msg);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="mx-auto max-w-2xl p-6 text-center text-destructive">
        {(error as Error)?.message ?? "שיחה לא נמצאה"}
      </div>
    );
  }

  const def = OUTPUT_TYPES[data.thread.output_type as OutputKey];
  const messages = data.messages;

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] w-full max-w-7xl gap-4 px-2 py-3 md:px-4">
      {/* Sidebar — threads */}
      <aside className="hidden w-64 shrink-0 flex-col gap-2 md:flex">
        <Button
          variant="outline"
          size="sm"
          className="justify-start gap-2"
          onClick={() => navigate({ to: "/dashboard" })}
        >
          <Plus className="h-4 w-4" />
          שיחה חדשה
        </Button>
        <div className="flex-1 overflow-y-auto rounded-lg border border-border bg-card p-2">
          <div className="mb-1 px-2 pt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            שיחות אחרונות
          </div>
          {threadsData?.threads.length === 0 && (
            <div className="px-2 py-4 text-center text-xs text-muted-foreground">
              עוד אין שיחות
            </div>
          )}
          {threadsData?.threads.map((t) => {
            const isActive = t.id === threadId;
            const tDef = OUTPUT_TYPES[t.output_type as OutputKey];
            const Icon = tDef?.icon ?? FileText;
            return (
              <Link
                key={t.id}
                to="/chat/$threadId"
                params={{ threadId: t.id }}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
                  isActive ? "bg-accent text-foreground" : "hover:bg-accent/60"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 shrink-0 ${tDef?.colorClass}`} />
                <span className="truncate">{t.title}</span>
              </Link>
            );
          })}
        </div>
      </aside>

      {/* Chat column */}
      <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-border bg-card">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => navigate({ to: "/dashboard" })}
              aria-label="חזרה"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
            {def && (
              <div className={`flex h-8 w-8 items-center justify-center rounded-md bg-accent ${def.colorClass}`}>
                <def.icon className="h-4 w-4" />
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{data.thread.title}</div>
              {def && (
                <div className="text-[11px] text-muted-foreground">{def.label}</div>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
            aria-label="מחק שיחה"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
          {messages.length === 0 && (
            <div className="mx-auto max-w-md py-12 text-center">
              {def && (
                <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-accent ${def.colorClass}`}>
                  <def.icon className="h-6 w-6" />
                </div>
              )}
              <h2 className="text-lg font-medium text-foreground">{def?.label}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                תאר/י במילים שלך את מה שצריך וה-AI יבנה לך {def?.category === "diagram" ? "תרשים" : "מסמך"}.
              </p>
            </div>
          )}
          <div className="mx-auto max-w-3xl space-y-5">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {sending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                חושב...
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="border-t border-border p-3">
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                messages.length === 0
                  ? `תאר/י את ה${def?.label ?? "מסמך"}...`
                  : "הוסף/י הבהרה או בקשת שינוי..."
              }
              rows={2}
              disabled={sending}
              className="min-h-[60px] resize-none"
            />
            <Button
              onClick={() => void handleSend()}
              disabled={sending || input.trim().length === 0}
              size="icon"
              className="h-10 w-10 shrink-0"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="mx-auto mt-2 max-w-3xl text-[11px] text-muted-foreground">
            Enter לשליחה · Shift+Enter לשורה חדשה
          </p>
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>למחוק את השיחה?</AlertDialogTitle>
            <AlertDialogDescription>
              ההודעות יימחקו. המסמכים והתרשימים שנוצרו יישארו ב'המסמכים שלי'.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMut.mutate()}
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

interface MessageRow {
  id: string;
  role: string;
  content: string;
  artifact_kind: string | null;
  artifact_id: string | null;
  created_at: string;
}

function MessageBubble({ message }: { message: MessageRow }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }
  // assistant
  return (
    <div className="space-y-2">
      <AssistantContent content={message.content} />
      {message.artifact_kind === "spec_document" && message.artifact_id && (
        <Link
          to="/editor/$id"
          params={{ id: message.artifact_id }}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:border-primary/40 hover:bg-accent"
        >
          <FileText className="h-3.5 w-3.5 text-primary" />
          פתח בעורך
          <ExternalLink className="h-3 w-3 text-muted-foreground" />
        </Link>
      )}
    </div>
  );
}

function AssistantContent({ content }: { content: string }) {
  // Split into segments — mermaid blocks vs text
  const segments: Array<{ kind: "text" | "mermaid"; value: string }> = [];
  const re = /```mermaid\s*\n([\s\S]*?)```/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) segments.push({ kind: "text", value: content.slice(last, m.index) });
    segments.push({ kind: "mermaid", value: m[1].trim() });
    last = m.index + m[0].length;
  }
  if (last < content.length) segments.push({ kind: "text", value: content.slice(last) });

  return (
    <div className="space-y-2 text-sm text-foreground">
      {segments.map((s, i) =>
        s.kind === "text" ? (
          s.value.trim() && (
            <div key={i} className="whitespace-pre-wrap leading-relaxed">
              {s.value}
            </div>
          )
        ) : (
          <DiagramBlock key={i} code={s.value} />
        ),
      )}
    </div>
  );
}

function DiagramBlock({ code }: { code: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-1.5">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <GitBranch className="h-3 w-3" />
          Mermaid
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-2 text-[11px]"
          onClick={() => {
            navigator.clipboard.writeText(code);
            toast.success("הקוד הועתק");
          }}
        >
          <Copy className="h-3 w-3" />
          העתק
        </Button>
      </div>
      <div className="h-[360px]">
        <MermaidPreview code={code} />
      </div>
    </div>
  );
}
