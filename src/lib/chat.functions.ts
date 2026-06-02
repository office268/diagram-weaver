import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const OutputKeySchema = z.string().min(1).max(64);

export const createChatThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { outputType: string; title?: string }) =>
    z.object({ outputType: OutputKeySchema, title: z.string().max(200).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: thread, error } = await supabase
      .from("chat_threads")
      .insert({
        user_id: userId,
        output_type: data.outputType,
        title: data.title ?? "שיחה חדשה",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { thread };
  });

export const listChatThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("chat_threads")
      .select("id, output_type, title, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { threads: data ?? [] };
  });

export const getChatThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { threadId: string }) =>
    z.object({ threadId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [{ data: thread, error: tErr }, { data: messages, error: mErr }] =
      await Promise.all([
        supabase.from("chat_threads").select("*").eq("id", data.threadId).maybeSingle(),
        supabase
          .from("chat_messages")
          .select("*")
          .eq("thread_id", data.threadId)
          .order("created_at", { ascending: true }),
      ]);
    if (tErr) throw new Error(tErr.message);
    if (mErr) throw new Error(mErr.message);
    if (!thread) throw new Error("שיחה לא נמצאה");
    return { thread, messages: messages ?? [] };
  });

export const deleteChatThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { threadId: string }) =>
    z.object({ threadId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("chat_threads").delete().eq("id", data.threadId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const renameChatThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { threadId: string; title: string }) =>
    z
      .object({ threadId: z.string().uuid(), title: z.string().min(1).max(200) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("chat_threads")
      .update({ title: data.title })
      .eq("id", data.threadId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
