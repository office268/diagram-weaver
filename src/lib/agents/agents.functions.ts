// ============================================================
// src/lib/agents/agents.functions.ts
// Server function (createServerFn) — agents.functions.ts
// נקודת RPC מהלקוח לשרת
// ============================================================
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/api/auth.server";
import { createLovableAiGatewayProvider } from "@/lib/ai/gateway.server";

const SuggestInput = z.object({
  field: z.enum(["name", "role_description", "knowledge"]),
  name: z.string().trim().max(120).default(""),
  role_title: z.string().trim().max(200).default(""),
  role_description: z.string().trim().max(10000).default(""),
  org_name: z.string().trim().max(200).default(""),
});

export const suggestPersonaField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SuggestInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("חסר מפתח LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);

    const ctx = [
      data.role_title ? `תפקיד: ${data.role_title}` : "",
      data.org_name ? `ארגון: ${data.org_name}` : "",
      data.name ? `שם נוכחי: ${data.name}` : "",
      data.role_description ? `תיאור נוכחי: ${data.role_description}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    let prompt: string;
    if (data.field === "name") {
      prompt = `הצע שם פרטי ישראלי יחיד (מילה אחת בלבד, ללא הסברים) לסוכן AI עם הפרטים הבאים:\n${ctx || "(ללא הקשר)"}\n\nהחזר רק את השם.`;
    } else if (data.field === "role_description") {
      prompt = `נסח הגדרת פרסונה לבעל התפקיד, פנייה ישירה בלשון "את/אתה" (התאם למגדר לפי השם אם ידוע, אחרת זכר). הגדר: תחום אחריות, סמכויות, תחומי מומחיות וגישה מקצועית. הנחה אותו במפורש להתנסח בשיחות בצורה תמציתית, עניינית וקצרה — רק מקצועי נטו, בלי דיבורי אווירה, בלי נימוסים מיותרים, בלי הקדמות. 3-5 משפטים בעברית. ללא כותרות וללא Markdown.\n\nהקשר:\n${ctx || "(ללא הקשר)"}\n\nהחזר רק את התיאור.`;
    } else {
      prompt = `פרט את הידע והמומחיות שסוכן AI צריך שייעמד לרשותו על מנת לבצע את תפקידו היטב. התייחס לנהלים, מערכות, מונחים מקצועיים, אילוצים עסקיים וכל מידע רקע רלוונטי. 4-8 משפטים בעברית. ללא כותרות וללא Markdown.\n\nהקשר:\n${ctx || "(ללא הקשר)"}\n\nהחזר רק את תוכן הידע.`;
    }

    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      prompt,
    });
    return { text: text.trim() };
  });

const SuggestConvInput = z.object({
  field: z.enum(["title", "topic"]),
  org_name: z.string().trim().max(200).default(""),
  org_description: z.string().trim().max(2000).default(""),
  participants: z.array(z.string().trim().max(200)).max(20).default([]),
  title: z.string().trim().max(200).default(""),
  topic: z.string().trim().max(5000).default(""),
});

export const suggestConversationField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SuggestConvInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("חסר מפתח LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);

    const ctx = [
      data.org_name ? `ארגון: ${data.org_name}` : "",
      data.org_description ? `על הארגון: ${data.org_description}` : "",
      data.participants.length ? `משתתפים: ${data.participants.join(", ")}` : "",
      data.title ? `כותרת נוכחית: ${data.title}` : "",
      data.topic ? `נושא נוכחי: ${data.topic}` : "",
    ].filter(Boolean).join("\n");

    const prompt = data.field === "title"
      ? `הצע שם קצר וברור בעברית (עד 8 מילים) לפרויקט חדש בתחום מערכות המידע של הארגון. הפרויקט מובל ע"י מנהל המוצר שמייצג את הארגון. השם צריך לשקף יוזמה ממשית ורלוונטית לפעילות הארגון. החזר רק את השם, ללא מרכאות וללא הסבר.\n\nהקשר:\n${ctx || "(ללא הקשר)"}`
      : `נסח נושא פתיחה לשיחת סוכנים בעברית עבור פרויקט חדש בתחום מערכות המידע של הארגון. מנהל המוצר, שהוא נציג הארגון, מציג את הצורך העסקי, את היעדים ואת השאלות המרכזיות שיש לדון בהן עם שאר המשתתפים. 2-4 משפטים, ללא כותרות וללא Markdown.\n\nהקשר:\n${ctx || "(ללא הקשר)"}\n\nהחזר רק את התוכן.`;

    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      prompt,
    });
    return { text: text.trim() };
  });

export const pickNextSpeaker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ conversationId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("חסר מפתח LOVABLE_API_KEY");

    const [{ data: conv }, { data: parts }, { data: msgs }] = await Promise.all([
      (supabase as any)
        .from("agent_conversations")
        .select("title, topic")
        .eq("id", data.conversationId)
        .maybeSingle(),
      (supabase as any)
        .from("agent_conversation_participants")
        .select("agent_personas:persona_id ( id, name, role_title, role_description )")
        .eq("conversation_id", data.conversationId),
      (supabase as any)
        .from("agent_messages")
        .select("role, content, persona_id, created_at")
        .eq("conversation_id", data.conversationId)
        .order("created_at", { ascending: true }),
    ]);

    const personas = (parts ?? [])
      .map((p: any) => p.agent_personas)
      .filter(Boolean) as Array<{ id: string; name: string; role_title: string; role_description: string }>;
    if (personas.length === 0) throw new Error("אין משתתפים בשיחה");

    const personaById = new Map(personas.map((p) => [p.id, p]));
    const history = (msgs ?? []).slice(-20).map((m: any) => {
      if (m.role === "moderator" || !m.persona_id) return `מנחה: ${m.content}`;
      const p = personaById.get(m.persona_id);
      return `${p?.name ?? "סוכן"} (${p?.role_title ?? ""}): ${m.content}`;
    }).join("\n\n");

    const roster = personas.map((p, i) =>
      `${i + 1}. id=${p.id} | ${p.name} — ${p.role_title}${p.role_description ? `\n   ${p.role_description.slice(0, 200)}` : ""}`,
    ).join("\n");

    const prompt = `אתה המנחה של שיחת סוכנים לקידום פרויקט מערכות מידע.
כותרת: ${conv?.title ?? ""}
נושא: ${conv?.topic ?? ""}

משתתפים:
${roster}

היסטוריית השיחה האחרונה:
${history || "(אין הודעות עדיין)"}

בחר את המשתתף הבא שהכי נכון שידבר עכשיו כדי לקדם את הפרויקט — לפי תפקידו, ההקשר, ומה שנאמר עד כה (העדף מי שלא דיבר לאחרונה אם אין סיבה אחרת). החזר אך ורק את ה-id של המשתתף שבחרת, ללא טקסט נוסף.`;

    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      prompt,
    });
    const raw = text.trim();
    const match = raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    const chosen = match?.[0];
    const valid = chosen && personaById.has(chosen) ? chosen : personas[0].id;
    return { personaId: valid };
  });


// ============ PERSONAS ============

export const listAgentPersonas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data, error } = await (supabase as any)
      .from("agent_personas")
      .select("*, organizations:org_id ( id, name )")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { personas: data ?? [] };
  });

const PersonaInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  org_id: z.string().uuid().nullable().optional(),
  role_title: z.string().trim().max(200).default(""),
  role_description: z.string().trim().max(10000).default(""),
  knowledge: z.string().trim().max(20000).default(""),
  tools: z.array(z.string().min(1).max(64)).max(20).default([]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6366f1"),
});

export const upsertAgentPersona = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PersonaInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const payload = {
      name: data.name,
      org_id: data.org_id ?? null,
      role_title: data.role_title,
      role_description: data.role_description,
      knowledge: data.knowledge,
      tools: data.tools,
      color: data.color,
      created_by: userId,
    };
    if (data.id) {
      const { error } = await (supabase as any)
        .from("agent_personas")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await (supabase as any)
      .from("agent_personas")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteAgentPersona = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await (supabase as any)
      .from("agent_personas")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ CONVERSATIONS ============

export const listAgentConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data, error } = await (supabase as any)
      .from("agent_conversations")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { conversations: data ?? [] };
  });

const CreateConvSchema = z.object({
  title: z.string().trim().min(1).max(200),
  topic: z.string().trim().max(5000).default(""),
  persona_ids: z.array(z.string().uuid()).min(1).max(20),
});

export const createAgentConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateConvSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: conv, error } = await (supabase as any)
      .from("agent_conversations")
      .insert({ title: data.title, topic: data.topic, created_by: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const rows = data.persona_ids.map((pid) => ({
      conversation_id: conv.id as string,
      persona_id: pid,
    }));
    const { error: pErr } = await (supabase as any)
      .from("agent_conversation_participants")
      .insert(rows);
    if (pErr) throw new Error(pErr.message);
    // Seed conversation with topic as a moderator message if provided
    if (data.topic.trim()) {
      await (supabase as any).from("agent_messages").insert({
        conversation_id: conv.id,
        persona_id: null,
        role: "moderator",
        content: data.topic.trim(),
      });
    }
    return { id: conv.id as string };
  });

export const getAgentConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ conversationId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const [{ data: conv, error: cErr }, { data: parts, error: pErr }, { data: msgs, error: mErr }] =
      await Promise.all([
        (supabase as any)
          .from("agent_conversations")
          .select("*")
          .eq("id", data.conversationId)
          .maybeSingle(),
        (supabase as any)
          .from("agent_conversation_participants")
          .select("persona_id, agent_personas:persona_id ( id, name, role_title, color )")
          .eq("conversation_id", data.conversationId),
        (supabase as any)
          .from("agent_messages")
          .select("*")
          .eq("conversation_id", data.conversationId)
          .order("created_at", { ascending: true }),
      ]);
    if (cErr) throw new Error(cErr.message);
    if (pErr) throw new Error(pErr.message);
    if (mErr) throw new Error(mErr.message);
    if (!conv) throw new Error("שיחה לא נמצאה");
    const participants = (parts ?? []).map((p: any) => p.agent_personas).filter(Boolean);
    return { conversation: conv, participants, messages: msgs ?? [] };
  });

export const deleteAgentConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ conversationId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await (supabase as any)
      .from("agent_conversations")
      .delete()
      .eq("id", data.conversationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addModeratorMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        conversationId: z.string().uuid(),
        content: z.string().trim().min(1).max(5000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await (supabase as any).from("agent_messages").insert({
      conversation_id: data.conversationId,
      persona_id: null,
      role: "moderator",
      content: data.content,
    });
    if (error) throw new Error(error.message);
    await (supabase as any)
      .from("agent_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", data.conversationId);
    return { ok: true };
  });
