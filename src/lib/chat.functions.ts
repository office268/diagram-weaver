import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ALLOWED_AGENT_MODELS } from "@/agents/shared/constants";


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
    return { thread: thread ?? null, messages: messages ?? [] };

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

export const updateChatThreadModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { threadId: string; model: string | null }) =>
    z
      .object({
        threadId: z.string().uuid(),
        model: z
          .union([
            z.enum(ALLOWED_AGENT_MODELS as unknown as [string, ...string[]]),
            z.null(),
          ])
          .nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // RLS on chat_threads scopes by user_id; the .eq below is defense in depth.
    const { error } = await supabase
      .from("chat_threads")
      .update({ model_override: data.model } as never)
      .eq("id", data.threadId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true, model: data.model };
  });


export const getChatThreadAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { threadId: string }) =>
    z.object({ threadId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: thread, error } = await supabase
      .from("chat_threads")
      .select("project_id")
      .eq("id", data.threadId)
      .maybeSingle<{ project_id: string | null }>();
    if (error) throw new Error(error.message);
    if (!thread?.project_id) {
      return { productName: "Product-00001", projectName: "Project-00001", projectId: null as string | null };
    }
    const { data: project, error: pErr } = await supabase
      .from("projects")
      .select("id, name, product_id, products:product_id ( name )")
      .eq("id", thread.project_id)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    const productName =
      ((project as unknown as { products?: { name?: string } | null })?.products?.name) ||
      "Product-00001";
    return {
      productName,
      projectName: project?.name ?? "Project-00001",
      projectId: project?.id ?? null,
    };
  });

export const assignChatThreadProductProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { threadId: string; orgId: string; productName: string; projectName: string }) =>
    z
      .object({
        threadId: z.string().uuid(),
        orgId: z.string().uuid(),
        productName: z.string().min(1).max(200),
        projectName: z.string().min(1).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rpcData, error: rpcErr } = await supabase.rpc(
      "ensure_product_and_project" as never,
      {
        _org_id: data.orgId,
        _product_name: data.productName,
        _project_name: data.projectName,
      } as never,
    );
    if (rpcErr) throw new Error(rpcErr.message);
    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    const productId = (row as { product_id: string }).product_id;
    const projectId = (row as { project_id: string }).project_id;

    const { error: updErr } = await supabase
      .from("chat_threads")
      .update({ project_id: projectId } as never)
      .eq("id", data.threadId)
      .eq("user_id", userId);
    if (updErr) throw new Error(updErr.message);

    return { productId, projectId };
  });

