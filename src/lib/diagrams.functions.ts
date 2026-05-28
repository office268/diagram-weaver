import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const idSchema = z.object({ id: z.string().uuid() });

export const listDiagrams = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("diagrams")
      .select("id, title, diagram_type, updated_at, created_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { diagrams: data ?? [] };
  });

export const getDiagram = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("diagrams")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Diagram not found");
    return { diagram: row };
  });

export const createDiagram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        title: z.string().min(1).max(200).optional(),
        diagram_type: z.string().min(1).max(50).optional(),
        code: z.string().max(50000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const defaultCode = data.code ?? "graph TD\n  A[Start] --> B{Decision}\n  B -->|Yes| C[Continue]\n  B -->|No| D[Stop]";
    const { data: row, error } = await supabase
      .from("diagrams")
      .insert({
        user_id: userId,
        title: data.title ?? "Untitled diagram",
        diagram_type: data.diagram_type ?? "flowchart",
        code: defaultCode,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { diagram: row };
  });

export const updateDiagram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().min(1).max(200).optional(),
        code: z.string().max(50000).optional(),
        diagram_type: z.string().min(1).max(50).optional(),
        positions: z.record(z.string(), z.any()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, ...patch } = data;
    const { data: row, error } = await supabase
      .from("diagrams")
      .update(patch)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { diagram: row };
  });

export const deleteDiagram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("diagrams")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
