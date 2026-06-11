// ============================================================
// src/routes/_authenticated/chat.$threadId.tsx
// מסך מאומת (Authenticated route) — chat.$threadId.tsx
// דורש משתמש מחובר; יושב תחת layout _authenticated
// ============================================================
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Send,
  Square,
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
import { extractTextFromFile } from "@/lib/rag/text-extractor.client";
import {
  getChatThread,
  listChatThreads,
  deleteChatThread,
  getChatThreadAssignment,
  assignChatThreadProductProject,
} from "@/lib/chat.functions";
import { useCurrentOrganization } from "@/hooks/use-current-organization";

import { cancelDiagramJob } from "@/lib/diagrams/diagrams.functions";
import { ThreadModelSelector } from "@/components/settings/thread-model-selector";
import { suggestUserPrompt } from "@/lib/ai/prompt-suggest.functions";
import { OUTPUT_TYPES, type OutputKey } from "@/lib/doc-types/output-types";
import { ActivitySwimlaneRenderer } from "@/components/diagrams/activity-swimlane-renderer";
import { MermaidPreview } from "@/components/diagrams/mermaid-preview";
import { DiagramRenderer } from "@/components/diagrams/diagram-renderer";
import { usePromptBoxSettings } from "@/lib/prompt-box-settings";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  head: () => ({ meta: [{ title: "שיחה — סוכן ניתוח מערכות" }] }),
  component: ChatPage,
});

interface Attachment {
  id: string;
  name: string;
  size: number;
  status: "uploading" | "uploaded" | "extracting" | "ready" | "failed";
  text?: string;
  truncated?: boolean;
  storagePath?: string;
  mimeType?: string;
  errorMessage?: string;
}

interface ActiveDiagramJob {
  id: string;
  status: string;
  stage: string | null;
  current_message_id: string | null;
  diagram_id: string | null;
  error_message: string | null;
  updated_at: string;
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
  const cancelDiagramJobFn = useServerFn(cancelDiagramJob);
  const getAssignmentFn = useServerFn(getChatThreadAssignment);
  const assignFn = useServerFn(assignChatThreadProductProject);
  const { data: currentOrg } = useCurrentOrganization();

  const assignmentQuery = useQuery({
    queryKey: ["chat-thread-assignment", threadId],
    queryFn: () => getAssignmentFn({ data: { threadId } }),
  });
  const [productName, setProductName] = useState("Product-00001");
  const [projectName, setProjectName] = useState("Project-00001");
  const [productDirty, setProductDirty] = useState(false);
  const [projectDirty, setProjectDirty] = useState(false);
  useEffect(() => {
    if (assignmentQuery.data) {
      if (!productDirty) setProductName(assignmentQuery.data.productName);
      if (!projectDirty) setProjectName(assignmentQuery.data.projectName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentQuery.data]);
  const assignMutation = useMutation({
    mutationFn: (vars: { productName: string; projectName: string }) => {
      if (!currentOrg?.id) throw new Error("אין ארגון משויך");
      return assignFn({
        data: {
          threadId,
          orgId: currentOrg.id,
          productName: vars.productName.trim() || "Product-00001",
          projectName: vars.projectName.trim() || "Project-00001",
        },
      });
    },
    onSuccess: () => {
      setProductDirty(false);
      setProjectDirty(false);
      qc.invalidateQueries({ queryKey: ["chat-thread-assignment", threadId] });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "שמירה נכשלה");
    },
  });
  const commitAssignment = () => {
    if (!productDirty && !projectDirty) return;
    if (!currentOrg?.id) return;
    assignMutation.mutate({ productName, projectName });
  };
  // Auto-create defaults the first time the thread has no project assigned.
  useEffect(() => {
    if (!currentOrg?.id) return;
    if (!assignmentQuery.data) return;
    if (assignmentQuery.data.projectId) return;
    if (assignMutation.isPending) return;
    assignMutation.mutate({
      productName: assignmentQuery.data.productName,
      projectName: assignmentQuery.data.projectName,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id, assignmentQuery.data?.projectId]);




  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const canceledRef = useRef(false);
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

  const [composerHeight, setComposerHeight] = useState<number>(180);
  const composerHeightRef = useRef(180);
  useEffect(() => { composerHeightRef.current = composerHeight; }, [composerHeight]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("chat-composer-height");
    if (saved) {
      const n = parseInt(saved, 10);
      if (!Number.isNaN(n)) {
        const max = Math.max(200, window.innerHeight * 0.6);
        setComposerHeight(Math.max(120, Math.min(max, n)));
      }
    }
  }, []);
  const startResizeComposer = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = composerHeightRef.current;
    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientY - startY;
      const max = Math.max(200, window.innerHeight * 0.6);
      // dragging up (negative delta) grows composer
      const next = Math.max(120, Math.min(max, startH - delta));
      setComposerHeight(next);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      try {
        window.localStorage.setItem("chat-composer-height", String(composerHeightRef.current));
      } catch {}
    };
    document.body.style.cursor = "row-resize";
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

  const [activeDiagramJob, setActiveDiagramJob] = useState<ActiveDiagramJob | null>(null);

  const deleteMut = useMutation({
    mutationFn: () => deleteThreadFn({ data: { threadId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-threads"] });
      toast.success("השיחה נמחקה");
      navigate({ to: "/dashboard" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "מחיקה נכשלה"),
  });

  // Background poll for any in-progress diagram job for this thread, so users
  // who navigate back to the chat see partial / final diagrams refresh in real-time.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const { data: jobs } = await supabase
        .from("diagram_jobs")
        .select("id,status,stage,current_message_id,diagram_id,error_message,updated_at")
        .eq("thread_id", threadId)
        .in("status", ["pending", "processing"])
        .order("updated_at", { ascending: false })
        .limit(1);
      if (cancelled) return;
      const nextJob = jobs?.[0] ?? null;
      setActiveDiagramJob(nextJob as ActiveDiagramJob | null);
      if (nextJob) {
        qc.invalidateQueries({ queryKey: ["chat-thread", threadId] });
      }
    };
    void tick();
    const id = setInterval(() => { void tick(); }, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [threadId, qc]);

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
    const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
    const MAX_CHARS = 60_000;

    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user?.id;
    if (!userId) {
      toast.error("נדרשת התחברות מחדש");
      return;
    }

    await Promise.all(
      list.map(async (file) => {
        const id = crypto.randomUUID();
        // Build an ASCII-only storage key. Supabase Storage rejects non-ASCII
        // characters (e.g. Hebrew) in object keys with InvalidKey. The original
        // filename is preserved separately for display only.
        const dotIdx = file.name.lastIndexOf(".");
        const rawExt = dotIdx > -1 ? file.name.slice(dotIdx + 1) : "";
        const safeExt = rawExt.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toLowerCase();
        const rawBase = dotIdx > -1 ? file.name.slice(0, dotIdx) : file.name;
        const asciiBase = rawBase
          .replace(/[^a-zA-Z0-9._-]+/g, "_")
          .replace(/^_+|_+$/g, "")
          .slice(0, 60);
        const safeName = `${asciiBase || "file"}${safeExt ? "." + safeExt : ""}`;
        const storagePath = `${userId}/${threadId}/${id}/${safeName}`;
        const mimeType = file.type || "application/octet-stream";

        setAttachments((prev) => [
          ...prev,
          {
            id,
            name: file.name,
            size: file.size,
            status: "uploading",
            storagePath,
            mimeType,
          },
        ]);

        if (file.size > MAX_BYTES) {
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === id
                ? { ...a, status: "failed", errorMessage: "הקובץ גדול מ-10MB" }
                : a,
            ),
          );
          toast.error(`${file.name}: הקובץ גדול מ-10MB`);
          return;
        }

        // 1) Upload original file to storage
        try {
          const { error: upErr } = await supabase.storage
            .from("chat-attachments")
            .upload(storagePath, file, {
              contentType: mimeType,
              upsert: false,
            });
          if (upErr) throw upErr;
        } catch (e) {
          const msg = e instanceof Error ? e.message : "העלאת הקובץ נכשלה";
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === id ? { ...a, status: "failed", errorMessage: msg } : a,
            ),
          );
          toast.error(`${file.name}: ${msg}`);
          return;
        }

        // 2) Mark uploaded so the user sees it
        setAttachments((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: "uploaded" } : a)),
        );

        // 3) Extract text in the browser
        setAttachments((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: "extracting" } : a)),
        );
        try {
          const { text: rawText } = await extractTextFromFile(file);
          const truncated = rawText.length > MAX_CHARS;
          const text = truncated ? rawText.slice(0, MAX_CHARS) : rawText;
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === id ? { ...a, status: "ready", text, truncated } : a,
            ),
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : "חילוץ טקסט נכשל";
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === id ? { ...a, status: "failed", errorMessage: msg } : a,
            ),
          );
          toast.error(`${file.name}: ${msg}`);
        }
      }),
    );
  }

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      void uploadFiles(e.target.files);
    }
    e.target.value = "";
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target?.storagePath) {
        void supabase.storage
          .from("chat-attachments")
          .remove([target.storagePath])
          .catch(() => undefined);
      }
      return prev.filter((a) => a.id !== id);
    });
  }

  async function handleSend() {
    const msg = input.trim();
    const readyAtts = attachments.filter((a) => a.status === "ready");
    const hasPending = attachments.some(
      (a) => a.status === "uploading" || a.status === "extracting",
    );
    if (hasPending) return;
    if ((!msg && readyAtts.length === 0) || sending) return;
    canceledRef.current = false;
    setCanceling(false);
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
            if (canceledRef.current) {
              await qc.invalidateQueries({ queryKey: ["chat-thread", threadId] });
              break;
            }
            if (Date.now() - startedAt > MAX_MS) {
              await qc.invalidateQueries({ queryKey: ["chat-thread", threadId] });
              throw new Error("חרגנו מזמן ההמתנה ליצירת התרשים. אפשר לנסות שוב.");
            }
            const { data: job, error: jobErr } = await supabase
              .from("diagram_jobs")
              .select("status,error_message,completed_at,diagram_id,current_message_id,cancel_requested")
              .eq("id", jobId)
              .maybeSingle();
            if (jobErr) throw new Error(jobErr.message);
            if (!job) continue;
            if (job.status === "done") {
              await qc.invalidateQueries({ queryKey: ["chat-thread", threadId] });
              if (!job.diagram_id) {
                throw new Error("התרשים סומן כהושלם אבל לא נשמר תוצר. אפשר לנסות שוב.");
              }
              break;
            }
            if (job.status === "failed") {
              await qc.invalidateQueries({ queryKey: ["chat-thread", threadId] });
              const errMsg = job.error_message || "יצירת התרשים נכשלה";
              if (canceledRef.current || /בוטל/.test(errMsg)) {
                // User-requested cancellation — exit quietly, no error toast.
                break;
              }
              throw new Error(errMsg);
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
      if (!canceledRef.current) {
        toast.error(e instanceof Error ? e.message : "שליחה נכשלה");
        setInput(msg);
        setAttachments(sentAtts);
      }
    } finally {
      setSending(false);
      setCanceling(false);
    }
  }

  async function handleStop() {
    if (canceling) return;
    canceledRef.current = true;
    setCanceling(true);
    try {
      const jobId = activeDiagramJob?.id;
      if (jobId) {
        await cancelDiagramJobFn({ data: { jobId } });
      }
      toast.info("התהליך בוטל");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ביטול נכשל");
    } finally {
      // Restore the composer immediately; the polling loop will exit on its own.
      setSending(false);
      setCanceling(false);
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
      className="mx-auto flex h-[calc(100vh-8rem)] w-full flex-col gap-4 px-2 py-3 md:grid md:gap-0 md:px-6"
      style={isDesktop ? { gridTemplateColumns: `${sidebarWidth}px 18px 1fr`, gridTemplateRows: `1fr 8px ${composerHeight}px` } : undefined}
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

      {/* Resize handle (desktop only) — drag to resize threads list vs chat */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="גרור כדי לשנות את רוחב רשימת השיחות"
        onMouseDown={startResize}
        onDoubleClick={() => {
          setSidebarWidth(256);
          try { window.localStorage.setItem("chat-sidebar-width", "256"); } catch {}
        }}
        title="גרור כדי לשנות גודל. לחיצה כפולה לאיפוס."
        className="group hidden md:col-start-2 md:row-start-1 md:row-span-3 md:flex md:cursor-col-resize md:items-center md:justify-center md:self-stretch"
      >
        <div className="flex h-24 w-[6px] flex-col items-center justify-center gap-1 rounded-full border border-border bg-muted shadow-sm transition-colors group-hover:border-primary group-hover:bg-primary/30 group-active:bg-primary">
          <span className="h-1 w-1 rounded-full bg-foreground/50" />
          <span className="h-1 w-1 rounded-full bg-foreground/50" />
          <span className="h-1 w-1 rounded-full bg-foreground/50" />
        </div>
      </div>

      {/* Chat column */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-xl border border-border bg-card md:col-start-3 md:row-start-1 md:row-span-3">
        {/* Product / Project assignment */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 text-xs">
          <label className="flex flex-1 items-center gap-1.5 min-w-[160px]">
            <span className="shrink-0 text-muted-foreground">מוצר:</span>
            <Input
              value={productName}
              onChange={(e) => { setProductName(e.target.value); setProductDirty(true); }}
              onBlur={commitAssignment}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
              placeholder="Product-00001"
              className="h-7 text-xs"
              disabled={!currentOrg?.id || assignMutation.isPending}
            />
          </label>
          <label className="flex flex-1 items-center gap-1.5 min-w-[160px]">
            <span className="shrink-0 text-muted-foreground">פרויקט:</span>
            <Input
              value={projectName}
              onChange={(e) => { setProjectName(e.target.value); setProjectDirty(true); }}
              onBlur={commitAssignment}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
              placeholder="Project-00001"
              className="h-7 text-xs"
              disabled={!currentOrg?.id || assignMutation.isPending}
            />
          </label>
          {assignMutation.isPending && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">

          {messages.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <div className="mx-auto max-w-md text-center">
                {def && (
                  <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-accent ${def.colorClass}`}>
                    <def.icon className="h-6 w-6" />
                  </div>
                )}
                <h2 className="text-lg font-medium text-foreground">אני מסייע AI מומחה לניתוח מערכות מידע</h2>
                <p className="mt-1 text-base font-medium text-foreground">{def?.label}</p>
                {sending && (
                  <div className="mt-3">
                    <GenerationProgress phaseIdx={phaseIdx} phases={phases} />
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="mx-auto max-w-3xl space-y-5">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {activeDiagramJob && !messages.some((m) => m.id === activeDiagramJob.current_message_id) && (
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <GenerationProgress
                  phaseIdx={phaseIdx}
                  phases={phases}
                  job={activeDiagramJob}
                />
              </div>
            )}
            {sending && messages.length > 0 && (
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <GenerationProgress phaseIdx={phaseIdx} phases={phases} />
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Horizontal resize handle (desktop only) — drag to resize threads list vs composer */}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="גרור כדי לשנות את גובה תיבת הצ'אט"
        onMouseDown={startResizeComposer}
        onDoubleClick={() => {
          setComposerHeight(180);
          try { window.localStorage.setItem("chat-composer-height", "180"); } catch {}
        }}
        title="גרור כדי לשנות גובה. לחיצה כפולה לאיפוס."
        className="group hidden md:col-start-1 md:row-start-2 md:flex md:cursor-row-resize md:items-center md:justify-center md:self-stretch"
      >
        <div className="flex h-[6px] w-24 flex-row items-center justify-center gap-1 rounded-full border border-border bg-muted shadow-sm transition-colors group-hover:border-primary group-hover:bg-primary/30 group-active:bg-primary">
          <span className="h-1 w-1 rounded-full bg-foreground/50" />
          <span className="h-1 w-1 rounded-full bg-foreground/50" />
          <span className="h-1 w-1 rounded-full bg-foreground/50" />
        </div>
      </div>

      {/* Composer */}
      <div
        className="px-3 pt-8 pb-16 md:col-start-1 md:row-start-3 md:overflow-y-auto md:pt-3 md:pb-3"
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
              {attachments.map((a) => {
                const statusLabel =
                  a.status === "uploading"
                    ? "מעלה…"
                    : a.status === "uploaded"
                      ? "הועלה"
                      : a.status === "extracting"
                        ? "מחלץ טקסט…"
                        : a.status === "failed"
                          ? a.errorMessage || "שגיאה"
                          : null;
                return (
                  <div
                    key={a.id}
                    className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
                      a.status === "failed"
                        ? "border-destructive/40 bg-destructive/5"
                        : "border-border bg-muted/50"
                    }`}
                    title={a.errorMessage || a.name}
                  >
                    {a.status === "uploading" || a.status === "extracting" ? (
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    ) : a.status === "uploaded" ? (
                      <Check className="h-3 w-3 text-muted-foreground" />
                    ) : a.status === "failed" ? (
                      <X className="h-3 w-3 text-destructive" />
                    ) : (
                      <Paperclip className="h-3 w-3 text-primary" />
                    )}
                    <span className="max-w-[140px] truncate">{a.name}</span>
                    {statusLabel && (
                      <span
                        className={`text-[10px] ${
                          a.status === "failed"
                            ? "text-destructive"
                            : "text-muted-foreground"
                        }`}
                      >
                        {statusLabel}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeAttachment(a.id)}
                      className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                      aria-label="הסר"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
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
                <div className="flex items-center gap-1">
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
                <ThreadModelSelector
                  threadId={threadId}
                  currentOverride={thread.model_override ?? null}
                  variant="icon"
                />
                </div>
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
                    onClick={() => {
                      if (sending) void handleStop();
                      else void handleSend();
                    }}
                    disabled={
                      canceling ||
                      (!sending &&
                        (attachments.some(
                          (a) =>
                            a.status === "uploading" ||
                            a.status === "extracting",
                        ) ||
                          (input.trim().length === 0 &&
                            attachments.filter((a) => a.status === "ready")
                              .length === 0)))
                    }
                    size="icon"
                    aria-label={sending ? "עצור" : "שלח"}
                    title={sending ? "עצור את התהליך" : "שלח"}
                    variant={sending ? "outline" : "default"}
                    className="h-8 w-8 shrink-0 rounded-full"
                  >
                    {canceling ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : sending ? (
                      <Square className="h-3.5 w-3.5 fill-current" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
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
      <AssistantActions message={message} />
    </div>
  );
}

function AssistantActions({ message }: { message: MessageRow }) {
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    toast.success("הועתק");
  };

  const handleDownload = () => {
    const blob = new Blob([message.content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `response-${message.id.slice(0, 8)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFeedback = (v: "up" | "down") => {
    setFeedback((prev) => (prev === v ? null : v));
    toast.success(v === "up" ? "תודה על המשוב" : "תודה, נשתפר");
  };

  return (
    <div className="flex items-center gap-0.5 pt-1 text-muted-foreground">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 hover:text-foreground"
        onClick={() => handleFeedback("up")}
        title="לייק"
      >
        <ThumbsUp className={`h-3.5 w-3.5 ${feedback === "up" ? "fill-current text-primary" : ""}`} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 hover:text-foreground"
        onClick={() => handleFeedback("down")}
        title="דיסלייק"
      >
        <ThumbsDown className={`h-3.5 w-3.5 ${feedback === "down" ? "fill-current text-destructive" : ""}`} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 hover:text-foreground"
        onClick={handleCopy}
        title="העתק"
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 hover:text-foreground"
        onClick={handleDownload}
        title="הורדה"
      >
        <Download className="h-3.5 w-3.5" />
      </Button>
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
  phaseIdx: _phaseIdx,
  phases: _phases,
  job,
}: {
  phaseIdx: number;
  phases: readonly string[];
  job?: ActiveDiagramJob | null;
}) {
  const statusLine = job?.error_message
    ? job.error_message
    : job?.stage === "generating"
      ? "התרשים עדיין נבנה. אם התהליך ייעצר, תופיע כאן שגיאה במקום מצב תקוע."
      : "המשימה עדיין בטיפול.";

  return (
    <div className="flex items-start justify-center gap-2 text-base">
      <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-primary" />
      <div className="space-y-1 text-center">
        <div className="font-medium text-foreground">
          {job?.stage === "generating" ? "מייצר תרשים" : "המשימה בטיפול"}
        </div>
        <div className="text-sm text-muted-foreground">{statusLine}</div>
      </div>
    </div>
  );
}

