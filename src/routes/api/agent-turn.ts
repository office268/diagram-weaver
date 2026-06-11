// ============================================================
// src/routes/api/agent-turn.ts
// HTTP endpoint (server route) — agent-turn.ts
// נקודת קצה ציבורית/פנימית עבור TanStack Start
// ============================================================
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { generateText } from "ai";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireBearerAuth, translateAiError } from "@/lib/api/auth.server";
import { createLovableAiGatewayProvider } from "@/lib/ai/gateway.server";

const BodySchema = z.object({
  conversationId: z.string().uuid(),
  personaId: z.string().uuid(),
});

export const Route = createFileRoute("/api/agent-turn")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authResult = await requireBearerAuth(request);
        if (!authResult.ok) return authResult.response;
        const { userId } = authResult;

        // Admin check
        const { data: roleRow } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "admin")
          .maybeSingle();
        if (!roleRow) return new Response("Forbidden", { status: 403 });

        let body: z.infer<typeof BodySchema>;
        try {
          body = BodySchema.parse(await request.json());
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return new Response("LOVABLE_API_KEY missing", { status: 500 });

        // Verify persona is a participant in the conversation
        const { data: participant } = await (supabaseAdmin as any)
          .from("agent_conversation_participants")
          .select("id")
          .eq("conversation_id", body.conversationId)
          .eq("persona_id", body.personaId)
          .maybeSingle();
        if (!participant) return new Response("Persona is not a participant", { status: 400 });

        // Load persona
        const { data: persona, error: pErr } = await (supabaseAdmin as any)
          .from("agent_personas")
          .select("*, organizations:org_id ( name )")
          .eq("id", body.personaId)
          .maybeSingle();
        if (pErr || !persona) return new Response("Persona not found", { status: 404 });

        // Load conversation + all participants for context
        const { data: conv } = await (supabaseAdmin as any)
          .from("agent_conversations")
          .select("*")
          .eq("id", body.conversationId)
          .maybeSingle();
        if (!conv) return new Response("Conversation not found", { status: 404 });

        const { data: allParts } = await (supabaseAdmin as any)
          .from("agent_conversation_participants")
          .select("agent_personas:persona_id ( id, name, role_title )")
          .eq("conversation_id", body.conversationId);
        const participantsList = (allParts ?? [])
          .map((p: any) => p.agent_personas)
          .filter(Boolean) as Array<{ id: string; name: string; role_title: string }>;

        // Load messages history
        const { data: history } = await (supabaseAdmin as any)
          .from("agent_messages")
          .select("*")
          .eq("conversation_id", body.conversationId)
          .order("created_at", { ascending: true });

        const orgName = (persona.organizations as any)?.name ?? "";

        const systemPrompt = [
          `אתה משחק את הדמות הבאה בשיחה רב־משתתפים:`,
          `שם: ${persona.name}`,
          persona.role_title ? `תפקיד: ${persona.role_title}` : "",
          orgName ? `ארגון: ${orgName}` : "",
          ``,
          `תיאור התפקיד והאופי שלך:`,
          persona.role_description || "(לא הוגדר)",
          ``,
          persona.knowledge
            ? `ידע ורקע שעומדים לרשותך:\n${persona.knowledge}`
            : "",
          ``,
          persona.tools && Array.isArray(persona.tools) && persona.tools.length
            ? `כלים שעומדים לרשותך: ${persona.tools.join(", ")}`
            : "",
          ``,
          `נושא השיחה: ${conv.title}${conv.topic ? ` — ${conv.topic}` : ""}`,
          ``,
          `משתתפים נוספים בשיחה:`,
          ...participantsList
            .filter((p) => p.id !== persona.id)
            .map((p) => `- ${p.name}${p.role_title ? ` (${p.role_title})` : ""}`),
          ``,
          `הנחיות:`,
          `- ענה בעברית, בגוף ראשון, מנקודת המבט של הדמות שלך.`,
          `- שמור על אופי עקבי, תמציתי וענייני (עד ~150 מילים).`,
          `- אל תכתוב את שמך כקידומת. תכתוב רק את תוכן ההודעה.`,
          `- אל תמציא דברים שלא נאמרו. אם חסר מידע, שאל את שאר המשתתפים או את המנחה.`,
        ]
          .filter(Boolean)
          .join("\n");

        type Msg = { role: "user" | "assistant"; content: string };
        const messages: Msg[] = [];
        for (const m of history ?? []) {
          if (m.persona_id === persona.id) {
            messages.push({ role: "assistant", content: m.content });
          } else if (m.role === "moderator") {
            messages.push({ role: "user", content: `[מנחה]: ${m.content}` });
          } else {
            // Other persona — find name
            const speaker = participantsList.find((p) => p.id === m.persona_id);
            const label = speaker ? speaker.name : "משתתף";
            messages.push({ role: "user", content: `[${label}]: ${m.content}` });
          }
        }
        if (messages.length === 0 || messages[messages.length - 1].role === "assistant") {
          messages.push({ role: "user", content: "בבקשה שתף את התגובה הראשונית שלך לנושא." });
        }

        try {
          const provider = createLovableAiGatewayProvider(apiKey);
          const model = provider("google/gemini-2.5-flash");
          const { text } = await generateText({
            model,
            system: systemPrompt,
            messages,
            temperature: 0.7,
          });

          const content = text.trim() || "(אין תגובה)";

          const { data: inserted, error: iErr } = await (supabaseAdmin as any)
            .from("agent_messages")
            .insert({
              conversation_id: body.conversationId,
              persona_id: body.personaId,
              role: "agent",
              content,
            })
            .select("*")
            .single();
          if (iErr) throw new Error(iErr.message);

          await (supabaseAdmin as any)
            .from("agent_conversations")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", body.conversationId);

          return Response.json({ ok: true, message: inserted });
        } catch (err) {
          console.error("[agent-turn] error:", err);
          const { status, message } = translateAiError(err);
          return new Response(message, { status });
        }
      },
    },
  },
});
