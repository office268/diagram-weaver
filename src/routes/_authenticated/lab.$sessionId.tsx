import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Loader2,
  Paperclip,
  Send,
  Trash2,
  Plus,
  Copy as CopyIcon,
  FileText,
  HelpCircle,
  FileOutput,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { extractTextFromFile, describeMime } from "@/lib/rag/text-extractor.client";

export const Route = createFileRoute("/_authenticated/lab/$sessionId")({
  component: LabPage,
});

interface LabDocument {
  id: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
}

interface LabQuestion {
  id: string;
  question: string;
  answer: string | null;
  answered_at: string | null;
  created_at: string;
}

interface LabSession {
  id: string;
  title: string;
  latest_output_md: string | null;
}

async function authedFetch(url: string, body: unknown) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function LabPage() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const sessionQ = useQuery({
    queryKey: ["lab-session", sessionId],
    queryFn: async (): Promise<LabSession | null> => {
      const { data } = await supabase
        .from("lab_sessions")
        .select("id, title, latest_output_md")
        .eq("id", sessionId)
        .maybeSingle();
      return data;
    },
  });

  const docsQ = useQuery({
    queryKey: ["lab-docs", sessionId],
    queryFn: async (): Promise<LabDocument[]> => {
      const { data } = await supabase
        .from("lab_documents")
        .select("id, file_name, mime_type, file_size, created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const questionsQ = useQuery({
    queryKey: ["lab-questions", sessionId],
    queryFn: async (): Promise<LabQuestion[]> => {
      const { data } = await supabase
        .from("lab_questions")
        .select("id, question, answer, answered_at, created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submittingAnswers, setSubmittingAnswers] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const session = sessionQ.data;
  const docs = docsQ.data ?? [];
  const questions = questionsQ.data ?? [];
  const unanswered = useMemo(() => questions.filter((q) => !q.answer), [questions]);
  const answered = useMemo(() => questions.filter((q) => q.answer), [questions]);

  const refreshAll = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["lab-session", sessionId] }),
      qc.invalidateQueries({ queryKey: ["lab-docs", sessionId] }),
      qc.invalidateQueries({ queryKey: ["lab-questions", sessionId] }),
    ]);

  async function handleSend() {
    const text = prompt.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const res = await authedFetch("/api/lab-chat", { sessionId, message: text });
      if (!res.ok) throw new Error(await res.text());
      setPrompt("");
      await refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בשליחת הפנייה");
    } finally {
      setSending(false);
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        try {
          const { text } = await extractTextFromFile(file);
          if (!text.trim()) {
            toast.warning(`לא חולץ טקסט מ-${file.name}`);
            continue;
          }
          const res = await authedFetch("/api/lab-upload", {
            sessionId,
            fileName: file.name,
            mimeType: describeMime(file),
            fileSize: file.size,
            text: text.slice(0, 400_000),
          });
          if (!res.ok) throw new Error(await res.text());
        } catch (e) {
          toast.error(`${file.name}: ${e instanceof Error ? e.message : "כשל"}`);
        }
      }
      await qc.invalidateQueries({ queryKey: ["lab-docs", sessionId] });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(target: "document" | "question" | "session", id: string) {
    const res = await authedFetch("/api/lab-delete", { target, id });
    if (!res.ok) {
      toast.error("מחיקה נכשלה");
      return;
    }
    if (target === "session") {
      navigate({ to: "/lab" });
      return;
    }
    await refreshAll();
  }

  async function handleSubmitAnswers() {
    const entries = Object.entries(answers).filter(([, v]) => v.trim());
    if (entries.length === 0) return;
    setSubmittingAnswers(true);
    try {
      const res = await authedFetch("/api/lab-answer", {
        sessionId,
        answers: entries.map(([id, answer]) => ({ id, answer })),
      });
      if (!res.ok) throw new Error(await res.text());
      setAnswers({});
      await qc.invalidateQueries({ queryKey: ["lab-questions", sessionId] });
      toast.success("התשובות נשמרו");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "כשל בשמירת תשובות");
    } finally {
      setSubmittingAnswers(false);
    }
  }

  async function handleNewSession() {
    navigate({ to: "/lab" });
  }

  // === Sub-panels ===
  const OutputPanel = (
    <Card className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <FileOutput className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">תוצרי אפיון</h2>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={!session?.latest_output_md}
            onClick={() => {
              if (session?.latest_output_md) {
                navigator.clipboard.writeText(session.latest_output_md);
                toast.success("הועתק");
              }
            }}
          >
            <CopyIcon className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleNewSession} title="סשן חדש">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {session?.latest_output_md ? (
          <article className="lab-md max-w-none text-sm leading-relaxed [&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mb-1 [&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-semibold [&_p]:mb-2 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pr-5 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pr-5 [&_li]:mb-1 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_pre]:my-2 [&_pre]:overflow-auto [&_pre]:rounded [&_pre]:bg-muted [&_pre]:p-2 [&_pre]:text-xs [&_table]:my-2 [&_table]:w-full [&_th]:border [&_th]:border-border [&_th]:p-1.5 [&_th]:text-right [&_td]:border [&_td]:border-border [&_td]:p-1.5 [&_blockquote]:my-2 [&_blockquote]:border-r-2 [&_blockquote]:border-border [&_blockquote]:pr-3 [&_blockquote]:text-muted-foreground [&_a]:text-primary [&_a]:underline">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{session.latest_output_md}</ReactMarkdown>
          </article>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            עוד אין תוצר. שלח/י פנייה כדי להתחיל.
          </div>
        )}
      </div>
    </Card>
  );

  const DocsPanel = (
    <Card className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">מסמכים ({docs.length})</h2>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-auto p-3">
        {docs.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">לא הועלו מסמכים</div>
        ) : (
          docs.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-card/50 px-2.5 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">{d.file_name}</div>
                <div className="text-[10px] text-muted-foreground">
                  {d.file_size ? `${Math.round(d.file_size / 1024)} KB` : ""}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete("document", d.id)}
                aria-label="מחק"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
        )}
      </div>
    </Card>
  );

  const QuestionsPanel = (
    <Card className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">שאלות לבירור ({unanswered.length})</h2>
        </div>
        {unanswered.length > 0 && Object.values(answers).some((v) => v.trim()) ? (
          <Button size="sm" disabled={submittingAnswers} onClick={handleSubmitAnswers}>
            {submittingAnswers ? <Loader2 className="h-3 w-3 animate-spin" /> : "שלח תשובות"}
          </Button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-auto p-3">
        {unanswered.length === 0 && answered.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            אין שאלות פתוחות
          </div>
        ) : null}
        {unanswered.map((q) => (
          <div key={q.id} className="space-y-1.5 rounded-md border border-border bg-card/50 p-2.5">
            <div className="flex items-start justify-between gap-2">
              <p className="flex-1 text-xs font-medium">{q.question}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete("question", q.id)}
                aria-label="מחק"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <Textarea
              value={answers[q.id] ?? ""}
              onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: e.target.value }))}
              placeholder="התשובה שלך..."
              className="min-h-[60px] text-xs"
            />
          </div>
        ))}
        {answered.length > 0 ? (
          <div className="pt-2">
            <div className="mb-2 text-[10px] uppercase text-muted-foreground">נענו</div>
            {answered.map((q) => (
              <div key={q.id} className="mb-1.5 rounded-md bg-muted/40 p-2 text-xs">
                <div className="font-medium">{q.question}</div>
                <div className="mt-1 text-muted-foreground">{q.answer}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </Card>
  );

  const PromptBar = (
    <Card className="p-3">
      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.txt,.md,.csv"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button
          variant="outline"
          size="icon"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          aria-label="צרף קבצים"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
        </Button>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder="כתוב פנייה חופשית, בקש אפיון, או שאל שאלה... (Ctrl+Enter לשליחה)"
          className="min-h-[56px] flex-1 resize-none text-sm"
        />
        <Button onClick={handleSend} disabled={sending || !prompt.trim()} size="icon">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </Card>
  );

  return (
    <div className="mx-auto flex h-[calc(100vh-7rem)] w-full max-w-[1600px] flex-col gap-3 p-3 [direction:rtl] md:h-[calc(100vh-9rem)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold">מעבדה</h1>
          {session ? (
            <Input
              value={session.title}
              onChange={(e) =>
                qc.setQueryData(["lab-session", sessionId], { ...session, title: e.target.value })
              }
              onBlur={async (e) => {
                await supabase
                  .from("lab_sessions")
                  .update({ title: e.target.value })
                  .eq("id", sessionId);
              }}
              className="h-7 w-48 text-xs"
            />
          ) : null}
          <span className="text-xs text-muted-foreground">Gemini 2.5 Pro · ללא לופים</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => handleDelete("session", sessionId)}>
          <Trash2 className="ml-1 h-3.5 w-3.5" />
          מחק סשן
        </Button>
      </div>

      {/* Desktop layout */}
      <div className="hidden min-h-0 flex-1 grid-cols-12 gap-3 lg:grid">
        <div className="col-span-8 min-h-0">{OutputPanel}</div>
        <div className="col-span-4 grid min-h-0 grid-rows-2 gap-3">
          <div className="min-h-0">{DocsPanel}</div>
          <div className="min-h-0">{QuestionsPanel}</div>
        </div>
      </div>

      {/* Mobile layout */}
      <Tabs defaultValue="output" className="flex min-h-0 flex-1 flex-col lg:hidden">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="output">תוצרים</TabsTrigger>
          <TabsTrigger value="docs">מסמכים ({docs.length})</TabsTrigger>
          <TabsTrigger value="questions">שאלות ({unanswered.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="output" className="mt-2 min-h-0 flex-1">{OutputPanel}</TabsContent>
        <TabsContent value="docs" className="mt-2 min-h-0 flex-1">{DocsPanel}</TabsContent>
        <TabsContent value="questions" className="mt-2 min-h-0 flex-1">{QuestionsPanel}</TabsContent>
      </Tabs>

      {/* Prompt bar (sticky bottom) */}
      <div className="shrink-0">{PromptBar}</div>
    </div>
  );
}
