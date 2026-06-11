// ============================================================
// src/lib/diagrams/diagrams.functions.ts
// Server function (createServerFn) — diagrams.functions.ts
// נקודת RPC מהלקוח לשרת
// ============================================================
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildSearchMaps, enrichRow } from "@/lib/rag/search-enrich.server";

export const listDiagrams = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("diagrams")
      .select("id, kind, title, prompt, created_at, updated_at, user_id")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const rows = (data ?? []).map((r) => ({ ...r, project_id: null }));
    const maps = await buildSearchMaps(supabase, rows);
    const diagrams = rows.map((r) => ({ ...r, ...enrichRow(r, maps) }));
    return { diagrams };
  });

export const getDiagram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: diagram, error } = await supabase
      .from("diagrams")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!diagram) throw new Error("תרשים לא נמצא");
    return { diagram };
  });

export const updateDiagram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; title?: string; mermaid_code?: string }) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().min(1).max(200).optional(),
        mermaid_code: z.string().max(50000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: { title?: string; mermaid_code?: string } = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.mermaid_code !== undefined) patch.mermaid_code = data.mermaid_code;
    const { error } = await supabase.from("diagrams").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteDiagram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("diagrams").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Mark a running diagram job for cancellation. The worker checks this flag
 * between pipeline steps and finalizes the job as failed with a friendly
 * "canceled by user" message. An in-flight LLM call cannot be aborted, but
 * no further steps will run.
 */
export const cancelDiagramJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { jobId: string }) =>
    z.object({ jobId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    // Verify ownership and that the job is still active before flagging it.
    const { data: job, error: loadErr } = await supabaseAdmin
      .from("diagram_jobs")
      .select("id, user_id, status")
      .eq("id", data.jobId)
      .maybeSingle();
    if (loadErr) throw new Error(loadErr.message);
    if (!job || job.user_id !== userId) {
      throw new Error("המשימה לא נמצאה");
    }
    if (job.status !== "pending" && job.status !== "processing") {
      return { ok: true, alreadyDone: true };
    }
    const { error: updErr } = await supabaseAdmin
      .from("diagram_jobs")
      .update({ cancel_requested: true, updated_at: new Date().toISOString() } as never)
      .eq("id", data.jobId);
    if (updErr) throw new Error(updErr.message);
    return { ok: true };
  });
