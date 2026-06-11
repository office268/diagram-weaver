// ============================================================
// src/components/chat/message-renderer.tsx
// רכיב UI — message-renderer.tsx
// שרשרת presentation טהורה לרינדור הודעות בשיחה
// ============================================================
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  GitBranch,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Download,
  FileText,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ActivitySwimlaneRenderer } from "@/components/diagrams/activity-swimlane-renderer";
import { MermaidPreview } from "@/components/diagrams/mermaid-preview";
import { DiagramRenderer } from "@/components/diagrams/diagram-renderer";

export interface MessageRow {
  id: string;
  role: string;
  content: string;
  artifact_kind: string | null;
  artifact_id: string | null;
  created_at: string;
}

export interface ActiveDiagramJob {
  id: string;
  status: string;
  stage: string | null;
  current_message_id: string | null;
  diagram_id: string | null;
  error_message: string | null;
  updated_at: string;
}

export function MessageBubble({ message }: { message: MessageRow }) {
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

export function GenerationProgress({
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
