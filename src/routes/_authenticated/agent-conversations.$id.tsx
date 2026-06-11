// ============================================================
// src/routes/_authenticated/agent-conversations.$id.tsx
// מסך מאומת (Authenticated route) — agent-conversations.$id.tsx
// דורש משתמש מחובר; יושב תחת layout _authenticated
// ============================================================
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Send, ArrowRight, Bot, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useSiteTexts } from "@/lib/site-texts-context";
import {
  getAgentConversation,
  addModeratorMessage,
  pickNextSpeaker,
} from "@/lib/agents/agents.functions";

export const Route = createFileRoute("/_authenticated/agent-conversations/$id")({
  head: () => ({ meta: [{ title: "שיחת סוכנים" }] }),
  component: AgentConversationPage,
});

interface PersonaLite {
  id: string;
  name: string;
  role_title: string;
  color: string;
}

interface MsgRow {
  id: string;
  conversation_id: string;
  persona_id: string | null;
  role: string;
  content: string;
  created_at: string;
}

function AgentConversationPage() {
  const { isAdmin } = useSiteTexts();
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const getFn = useServerFn(getAgentConversation);
  const modFn = useServerFn(addModeratorMessage);
  const pickFn = useServerFn(pickNextSpeaker);

  const [moderatorMsg, setModeratorMsg] = useState("");
  const [generating, setGenerating] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["agent-conversation", id],
    queryFn: () => getFn({ data: { conversationId: id } }),
    enabled: isAdmin,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages?.length, generating]);

  async function generateTurn(personaId: string) {
    setGenerating(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("חסר אימות");
      const res = await fetch("/api/agent-turn", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ conversationId: id, personaId }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "יצירה נכשלה");
      }
      qc.invalidateQueries({ queryKey: ["agent-conversation", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "יצירה נכשלה");
    } finally {
      setGenerating(false);
    }
  }

  const sendModerator = useMutation({
    mutationFn: async () => {
      await modFn({ data: { conversationId: id, content: moderatorMsg.trim() } });
    },
    onSuccess: async () => {
      setModeratorMsg("");
      await qc.invalidateQueries({ queryKey: ["agent-conversation", id] });
      try {
        const { personaId } = await pickFn({ data: { conversationId: id } });
        await generateTurn(personaId);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "בחירת דובר נכשלה");
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שליחה נכשלה"),
  });

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-center text-sm text-muted-foreground">
        רק אדמין יכול לגשת לעמוד זה.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const participants = (data?.participants ?? []) as PersonaLite[];
  const personaById = new Map(participants.map((p) => [p.id, p]));
  const busy = sendModerator.isPending || generating;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col h-[calc(100vh-160px)] px-4 py-4">
      <div className="flex items-center gap-2 pb-3 border-b border-border">
        <Button asChild variant="ghost" size="icon">
          <Link to="/agent-conversations">
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="text-base font-semibold truncate">{data?.conversation?.title}</div>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {participants.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-white"
                style={{ backgroundColor: p.color }}
              >
                <Bot className="h-3 w-3" />
                {p.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {(data?.messages ?? []).map((m: MsgRow) => {
          const isModerator = m.role === "moderator" || !m.persona_id;
          const persona = m.persona_id ? personaById.get(m.persona_id) : null;
          return (
            <div key={m.id} className="flex gap-3" dir="rtl">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: isModerator ? "#475569" : persona?.color ?? "#6366f1" }}
              >
                {isModerator ? <UserIcon className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-muted-foreground mb-1">
                  {isModerator ? "מנחה" : persona?.name ?? "סוכן"}
                  {!isModerator && persona?.role_title ? (
                    <span className="font-normal"> — {persona.role_title}</span>
                  ) : null}
                </div>
                <div className="text-sm whitespace-pre-wrap leading-relaxed text-foreground">
                  {m.content}
                </div>
              </div>
            </div>
          );
        })}
        {generating ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            הסוכן חושב...
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border pt-3">
        <div className="flex gap-2">
          <Textarea
            dir="auto"
            value={moderatorMsg}
            onChange={(e) => setModeratorMsg(e.target.value)}
            rows={2}
            placeholder="הודעת מנחה — כתוב הנחיה או שאלה. ניתן לציין מי תרצה שיענה..."
            className="flex-1 text-sm"
          />
          <Button
            onClick={() => sendModerator.mutate()}
            disabled={!moderatorMsg.trim() || busy}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
