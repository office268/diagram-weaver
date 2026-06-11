// ============================================================
// src/lib/projects/products.functions.ts
// Server function (createServerFn) — products.functions.ts
// נקודת RPC מהלקוח לשרת
// ============================================================
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const idSchema = z.object({ id: z.string().uuid() });

export const listProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ orgId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: products, error } = await supabase
      .from("products")
      .select("id, name, description, created_at, updated_at, org_id")
      .eq("org_id", data.orgId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = (products ?? []).map((p) => p.id);
    let counts = new Map<string, number>();
    if (ids.length) {
      const { data: projs, error: pErr } = await supabase
        .from("projects")
        .select("product_id")
        .in("product_id", ids);
      if (pErr) throw new Error(pErr.message);
      for (const row of projs ?? []) {
        const pid = (row as { product_id: string | null }).product_id;
        if (!pid) continue;
        counts.set(pid, (counts.get(pid) ?? 0) + 1);
      }
    }

    return {
      products: (products ?? []).map((p) => ({
        ...p,
        project_count: counts.get(p.id) ?? 0,
      })),
    };
  });

export const getProduct = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: product, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!product) throw new Error("Product not found");

    const { data: projects, error: pErr } = await supabase
      .from("projects")
      .select("id, name, description, updated_at, created_at, pinned_at")
      .eq("product_id", data.id)
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (pErr) throw new Error(pErr.message);

    return { product, projects: projects ?? [] };
  });

export const createProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        orgId: z.string().uuid(),
        name: z.string().min(1).max(200),
        description: z.string().max(2000).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("products")
      .insert({
        org_id: data.orgId,
        name: data.name,
        description: data.description,
        created_by: userId,
      } as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { product: row };
  });

export const updateProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().min(1).max(200).optional(),
        description: z.string().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { id, ...patch } = data;
    const { data: row, error } = await supabase
      .from("products")
      .update(patch as never)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { product: row };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listProductProjectSpecs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ projectId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: specs, error } = await supabase
      .from("spec_documents")
      .select("id, title, doc_type, updated_at")
      .eq("project_id", data.projectId)
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { specs: specs ?? [] };
  });
