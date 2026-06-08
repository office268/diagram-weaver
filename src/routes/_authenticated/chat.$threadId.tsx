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
  Paperclip,
  X,
  Image as ImageIcon,
  Link as LinkIcon,
  File as FileIcon,
  Sparkles,
  ListChecks,
  Hammer,
  ChevronDown,
  ChevronUp,
  Check,
  ThumbsUp,
  ThumbsDown,
  Download,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { ThreadModelSelector } from "@/components/thread-model-selector";
import { suggestUserPrompt } from "@/lib/prompt-suggest.functions";
import { OUTPUT_TYPES, type OutputKey } from "@/lib/output-types";
import { ActivitySwimlaneRenderer } from "@/components/activity-swimlane-renderer";
import { MermaidPreview } from "@/components/mermaid-preview";
import { DiagramRenderer } from "@/components/diagram-renderer";
import { usePromptBoxSettings } from "@/lib/prompt-box-settings";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  head: () => ({ meta: [{ title: "שיחה — סוכן ניתוח מערכות" }] }),
  component: ChatPage,
});

interface Attachment {
  id: string;
  name: string;
  size: number;
  status: "uploading" | "ready";
  text?: string;
  truncated?: boolean;
}



const MODE_META = {
  auto: {
    label: "Auto",
    icon: Sparkles,
    description: "ה-AI מחליט אם לשאול הבהרות או לייצר ישר.",
  },
  plan: {
    label: "Plan",
    icon: ListChecks,
    description: "שאלות הבהרה והצעת מבנה בלבד, ללא יצירת מסמך/תרשים.",
  },
  build: {
    label: "Build",
    icon: Hammer,
    description: "מייצר את המסמך/תרשים ישר לפי הבקשה.",
  },
} as const;

function ChatPage() {
  const { threadId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getThreadFn = useServerFn(getChatThread);
  const listThreadsFn = useServerFn(listChatThreads);
  const deleteThreadFn = useServerFn(deleteChatThread);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const phases = [
    "מנתח את הבקשה",
    "מאחזר הקשר רלוונטי",
    "מזקק דרישות מרכזיות",
    "בונה מודל סמנטי",
    "מתכנן ארכיטקטורת פתרון",
    "מסיק קשרים בין ישויות",
    "מייצר טיוטה ראשונית",
    "מאמת עקביות לוגית",
    "מבצע ביקורת עצמית",
    "משכלל ניסוחים",
    "מאחד תובנות",
    "מלטש את התוצר הסופי",
  ] as const;
  useEffect(() => {
    if (!sending) { setPhaseIdx(0); return; }
    const id = setInterval(
      () => setPhaseIdx((i) => (i + 1) % phases.length),
      3200,
    );
    return () => clearInterval(id);
  }, [sending, phases.length]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const suggestPromptFn = useServerFn(suggestUserPrompt);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [mode, setMode] = useState<"auto" | "plan" | "build">("auto");
  const [modeReady, setModeReady] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const [sidebarWidth, setSidebarWidth] = useState<number>(256);
  const sidebarWidthRef = useRef(256);
  useEffect(() => { sidebarWidthRef.current = sidebarWidth; }, [sidebarWidth]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("chat-sidebar-width");
    if (saved) {
      const n = parseInt(saved, 10);
      if (!Number.isNaN(n)) setSidebarWidth(Math.max(180, Math.min(560, n)));
    }
  }, []);
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebarWidthRef.current;
    const isRtl = typeof document !== "undefined" && document.documentElement.dir === "rtl";
    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      const next = Math.max(180, Math.min(560, startW + (isRtl ? -delta : delta)));
      setSidebarWidth(next);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      try {
        window.localStorage.setItem("chat-sidebar-width", String(sidebarWidthRef.current));
      } catch {}
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  const promptBoxSettings = usePromptBoxSettings();
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("chat-mode");
    if (saved === "plan" || saved === "build" || saved === "auto") {
      setMode(saved);
    }
    setModeReady(true);
  }, []);
  // Pickup prefilled text (e.g. from meeting transcript flow)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const key = `chat-prefill:${threadId}`;
      const pre = window.sessionStorage.getItem(key);
      if (pre) {
        setInput(pre);
        window.sessionStorage.removeItem(key);
      }
    } catch { /* sessionStorage may be unavailable */ }
  }, [threadId]);
  useEffect(() => {
    if (typeof window === "undefined" || !modeReady) return;
    window.localStorage.setItem("chat-mode", mode);
  }, [mode, modeReady]);
  // Keep selected mode in sync with allowed modes from settings
  useEffect(() => {
    if (!promptBoxSettings.allowedModes[mode]) {
      const fallback = (["auto", "plan", "build"] as const).find(
        (m) => promptBoxSettings.allowedModes[m],
      );
      if (fallback) setMode(fallback);
    }
  }, [promptBoxSettings, mode]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["chat-thread", threadId],
    queryFn: () => getThreadFn({ data: { threadId } }),
    retry: false,
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

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files);
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) {
      toast.error("נדרשת התחברות מחדש");
      return;
    }
    for (const file of list) {
      const id = crypto.randomUUID();
      setAttachments((prev) => [
        ...prev,
        { id, name: file.name, size: file.size, status: "uploading" },
      ]);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/chat-attach", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (!res.ok) {
          const t = await res.text().catch(() => "");
          throw new Error(t || `שגיאה ${res.status}`);
        }
        const json = (await res.json()) as {
          fileName: string;
          size: number;
          text: string;
          truncated: boolean;
        };
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === id
              ? { ...a, status: "ready", text: json.text, truncated: json.truncated }
              : a,
          ),
        );
      } catch (e) {
        toast.error(
          `${file.name}: ${e instanceof Error ? e.message : "העלאה נכשלה"}`,
        );
        setAttachments((prev) => prev.filter((a) => a.id !== id));
      }
    }
  }

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      void uploadFiles(e.target.files);
    }
    e.target.value = "";
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  async function handleSend() {
    const msg = input.trim();
    const readyAtts = attachments.filter((a) => a.status === "ready");
    const hasUploading = attachments.some((a) => a.status === "uploading");
    if (hasUploading) {
      toast.info("ממתין לסיום העלאת קבצים...");
      return;
    }
    if ((!msg && readyAtts.length === 0) || sending) return;
    setSending(true);
    setInput("");
    const sentAtts = readyAtts;
    setAttachments([]);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("נדרשת התחברות מחדש");

      let composed = msg;
      if (sentAtts.length > 0) {
        const filesBlock = sentAtts
          .map(
            (a) =>
              `--- קובץ: ${a.name}${a.truncated ? " (קוצץ)" : ""} ---\n${a.text ?? ""}`,
          )
          .join("\n\n");
        composed =
          `[קבצים מצורפים]\n${filesBlock}\n\n[הודעת המשתמש]\n${msg || "(ראה קבצים מצורפים)"}`;
      }

      const res = await fetch("/api/chat-message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ threadId, message: composed, mode }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `שגיאה ${res.status}`);
      }
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const json = (await res.json()) as {
          ok?: boolean;
          async?: boolean;
          jobId?: string;
          mode?: string;
        };
        // Async diagram job — poll diagram_jobs until done/failed
        if (json.async && json.jobId) {
          const jobId = json.jobId;
          // Refresh chat so the user message shows + a "מעבד..." indicator can render
          await qc.invalidateQueries({ queryKey: ["chat-thread", threadId] });
          const startedAt = Date.now();
          const MAX_MS = 10 * 60 * 1000; // 10 minutes safety cap
          // eslint-disable-next-line no-constant-condition
          while (true) {
            await new Promise((r) => setTimeout(r, 2000));
            if (Date.now() - startedAt > MAX_MS) {
              await qc.invalidateQueries({ queryKey: ["chat-thread", threadId] });
              throw new Error("חרגנו מזמן ההמתנה ליצירת התרשים. אפשר לנסות שוב.");
            }
            const { data: job, error: jobErr } = await supabase
              .from("diagram_jobs")
              .select("status,error_message,completed_at")
              .eq("id", jobId)
              .maybeSingle();
            if (jobErr) throw new Error(jobErr.message);
            if (!job) continue;
            if (job.status === "done") break;
            if (job.status === "failed") {
              await qc.invalidateQueries({ queryKey: ["chat-thread", threadId] });
              throw new Error(job.error_message || "יצירת התרשים נכשלה");
            }
            if (job.completed_at) {
              await qc.invalidateQueries({ queryKey: ["chat-thread", threadId] });
            }
            // pending/processing — keep polling, refresh chat so progress is visible
            await qc.invalidateQueries({ queryKey: ["chat-thread", threadId] });
          }
        }
      } else if (contentType.includes("text/plain") && res.body) {
        // Streamed response with heartbeats; the final payload follows __RESULT__ or __ERROR__.
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
        }
        buf += decoder.decode();
        const errIdx = buf.indexOf("__ERROR__\n");
        if (errIdx !== -1) {
          throw new Error(buf.slice(errIdx + "__ERROR__\n".length).trim() || "שליחה נכשלה");
        }
        const resIdx = buf.indexOf("__RESULT__\n");
        if (resIdx === -1) {
          throw new Error("תגובת השרת נקטעה");
        }
      }

      await qc.invalidateQueries({ queryKey: ["chat-thread", threadId] });
      await qc.invalidateQueries({ queryKey: ["chat-threads"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "שליחה נכשלה");
      setInput(msg);
      setAttachments(sentAtts);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(_e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter inserts a newline (default). Sending is via the send button only.
  }

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error || !data || !data.thread) {
    return (
      <div className="mx-auto max-w-2xl p-6 text-center text-destructive">
        {(error as Error)?.message ?? "שיחה לא נמצאה"}
      </div>
    );
  }


  const def = OUTPUT_TYPES[data.thread.output_type as OutputKey];
  const messages = data.messages;
  const thread = data.thread as typeof data.thread & { model_override?: string | null };

  return (
    <div
      className="mx-auto flex h-[calc(100vh-8rem)] w-full flex-col gap-4 px-2 py-3 md:grid md:grid-rows-[1fr_auto] md:px-6"
      style={isDesktop ? { gridTemplateColumns: `${sidebarWidth}px 12px 1fr` } : undefined}
    >
      {/* Sidebar — threads */}
      <aside
        className="hidden min-h-0 shrink-0 flex-col gap-2 md:col-start-1 md:row-start-1 md:flex"
        style={isDesktop ? { width: sidebarWidth } : undefined}
      >
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

      {/* Resize handle (desktop only) */}
      <div
        role="separator"
        aria-orientation="vertical"
        onMouseDown={startResize}
        className="hidden md:col-start-2 md:row-span-2 md:block md:cursor-col-resize md:self-stretch md:w-1.5 md:rounded-full md:bg-muted-foreground/30 md:hover:bg-primary/60 md:transition-colors"
      />

      {/* Chat column */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-xl border border-border bg-card md:col-start-3 md:row-span-2">

        {messages.length > 0 && (
          <div className="flex shrink-0 items-center justify-end border-b border-border px-3 py-2">
            <ThreadModelSelector
              threadId={threadId}
              currentOverride={thread.model_override ?? null}
              variant="compact"
            />
          </div>
        )}

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
          {messages.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <div className="mx-auto max-w-md text-center">
                <div className="mb-4 flex justify-center">
                  <ThreadModelSelector
                    threadId={threadId}
                    currentOverride={(thread as { model_override?: string | null } | null)?.model_override ?? null}
                  />
                </div>
                {def && (
                  <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-accent ${def.colorClass}`}>
                    <def.icon className="h-6 w-6" />
                  </div>
                )}
                <h2 className="text-lg font-medium text-foreground">אני מסייע AI מומחה לניתוח מערכות מידע</h2>
                <p className="mt-1 text-base font-medium text-foreground">{def?.label}</p>
                {sending ? (
                  <div className="mt-3">
                    <GenerationProgress phaseIdx={phaseIdx} phases={phases} />
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground min-h-[1.25rem]">ממתין להוראות</p>
                )}
              </div>
            </div>
          )}
          <div className="mx-auto max-w-3xl space-y-5">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {sending && messages.length > 0 && (
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <GenerationProgress phaseIdx={phaseIdx} phases={phases} />
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Composer */}
      <div
        className="px-3 pt-3 pb-16 md:col-start-1 md:row-start-2 md:pb-3"
        style={isDesktop ? { width: sidebarWidth } : undefined}
      >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.txt,.docx,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={onPickFiles}
          />
          <input
            ref={imageInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={onPickFiles}
          />
          <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>הוספת קישור</DialogTitle>
                <DialogDescription>
                  הדבק/י כתובת URL לצירוף להודעה.
                </DialogDescription>
              </DialogHeader>
              <Input
                dir="ltr"
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const url = linkUrl.trim();
                    if (!url) return;
                    setInput((prev) => (prev ? `${prev}\n${url}` : url));
                    setLinkUrl("");
                    setLinkOpen(false);
                    setTimeout(() => textareaRef.current?.focus(), 0);
                  }
                }}
              />
              <DialogFooter>
                <Button variant="ghost" onClick={() => { setLinkUrl(""); setLinkOpen(false); }}>
                  ביטול
                </Button>
                <Button
                  onClick={() => {
                    const url = linkUrl.trim();
                    if (!url) return;
                    setInput((prev) => (prev ? `${prev}\n${url}` : url));
                    setLinkUrl("");
                    setLinkOpen(false);
                    setTimeout(() => textareaRef.current?.focus(), 0);
                  }}
                  disabled={!linkUrl.trim()}
                >
                  הוסף
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {attachments.length > 0 && (
            <div className="mx-auto mb-2 flex max-w-3xl flex-wrap gap-2">
              {attachments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-1 text-xs"
                >
                  {a.status === "uploading" ? (
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  ) : (
                    <Paperclip className="h-3 w-3 text-primary" />
                  )}
                  <span className="max-w-[140px] truncate">{a.name}</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(a.id)}
                    className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label="הסר"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="mx-auto max-w-3xl">
            <div className="flex flex-col rounded-2xl border border-input bg-background shadow-sm focus-within:ring-2 focus-within:ring-ring">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  messages.length === 0
                    ? promptBoxSettings.defaultPlaceholder?.trim()
                      ? promptBoxSettings.defaultPlaceholder
                      : `תאר את ה${def?.label ?? "מסמך"} שתרצה ליצור...`
                    : "הוסף/י הבהרה או בקשת שינוי..."
                }
                rows={promptBoxSettings.rows}
                disabled={sending}
                className="min-h-[72px] max-h-[260px] w-full resize-none overflow-y-auto border-0 bg-transparent px-3 py-2 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <div className="flex items-center justify-between gap-1 px-1.5 pb-1.5">
                {true ? (
                  <Popover open={attachMenuOpen} onOpenChange={setAttachMenuOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
                        disabled={sending}
                        aria-label="הוסף"
                        title="הוסף"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent side="top" align="start" className="w-48 p-1">
                      {promptBoxSettings.allowedUploads.file && (
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent"
                          onClick={() => {
                            setAttachMenuOpen(false);
                            fileInputRef.current?.click();
                          }}
                        >
                          <FileIcon className="h-4 w-4 text-muted-foreground" />
                          קובץ
                        </button>
                      )}
                      {promptBoxSettings.allowedUploads.image && (
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent"
                          onClick={() => {
                            setAttachMenuOpen(false);
                            imageInputRef.current?.click();
                          }}
                        >
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                          תמונה
                        </button>
                      )}
                      {promptBoxSettings.allowedUploads.link && (
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent"
                          onClick={() => {
                            setAttachMenuOpen(false);
                            setLinkOpen(true);
                          }}
                        >
                          <LinkIcon className="h-4 w-4 text-muted-foreground" />
                          קישור
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={suggesting}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent disabled:opacity-60"
                        onClick={async () => {
                          setAttachMenuOpen(false);
                          setSuggesting(true);
                          try {
                            const res = await suggestPromptFn({ data: { threadId } });
                            const text = (res?.prompt ?? "").trim();
                            if (text) {
                              setInput((prev) => (prev ? `${prev}\n\n${text}` : text));
                              requestAnimationFrame(() => textareaRef.current?.focus());
                            } else {
                              toast.error("לא הופק פרומפט. נסה/י שוב.");
                            }
                          } catch (err) {
                            const msg = err instanceof Error ? err.message : String(err);
                            toast.error(`שגיאה ביצירת פרומפט: ${msg}`);
                          } finally {
                            setSuggesting(false);
                          }
                        }}
                      >
                        {suggesting ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <Sparkles className="h-4 w-4 text-primary" />
                        )}
                        חולל פרומפט עם AI
                      </button>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <div />
                )}
                <div className="flex items-center gap-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={sending}
                        className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
                        title={`מצב: ${MODE_META[mode].label}`}
                        aria-label={`מצב: ${MODE_META[mode].label}`}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      {(["auto", "plan", "build"] as const)
                        .filter((m) => promptBoxSettings.allowedModes[m])
                        .map((m) => {
                        const meta = MODE_META[m];
                        const Icon = meta.icon;
                        const active = mode === m;
                        return (
                          <DropdownMenuItem
                            key={m}
                            onClick={() => setMode(m)}
                            className="flex items-start gap-2 py-2"
                          >
                            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium">{meta.label}</span>
                                {active && <Check className="h-3.5 w-3.5 text-primary" />}
                              </div>
                              <p className="text-[11px] leading-snug text-muted-foreground">
                                {meta.description}
                              </p>
                            </div>
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    onClick={() => void handleSend()}
                    disabled={
                      sending ||
                      (input.trim().length === 0 &&
                        attachments.filter((a) => a.status === "ready").length === 0)
                    }
                    size="icon"
                    aria-label="שלח"
                    title="שלח"
                    className="h-8 w-8 shrink-0 rounded-full"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
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
  // Split into segments — diagram blocks (Mermaid / SVG / RF JSON) vs text
  const segments: Array<{ kind: "text" | "diagram"; value: string }> = [];
  const re = /```(?:mermaid|svg|rf-json)\s*\n([\s\S]*?)```/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) segments.push({ kind: "text", value: content.slice(last, m.index) });
    segments.push({ kind: "diagram", value: m[1].trim() });
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
  const isSvg = code.trimStart().toLowerCase().startsWith("<svg");
  const isRfJson = code.trimStart().startsWith("{");
  const label = isRfJson ? "Diagram" : isSvg ? "Activity SVG" : "Mermaid";

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-1.5">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <GitBranch className="h-3 w-3" />
          {label}
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
        {isRfJson ? (
          <DiagramRenderer code={code} />
        ) : isSvg ? (
          <ActivitySwimlaneRenderer code={code} />
        ) : (
          <MermaidPreview code={code} />
        )}
      </div>
    </div>
  );
}

function GenerationProgress({
  phaseIdx,
  phases,
}: {
  phaseIdx: number;
  phases: readonly string[];
}) {
  const label = phases[phaseIdx % phases.length];
  return (
    <div className="flex items-center justify-center gap-2 text-base">
      <Loader2 className="h-4 w-4 animate-spin text-primary" />
      <span
        key={label}
        className="font-medium text-foreground animate-in fade-in slide-in-from-bottom-1 duration-300"
      >
        {label}…
      </span>
    </div>
  );
}
