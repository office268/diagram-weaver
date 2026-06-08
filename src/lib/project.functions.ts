import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const idSchema = z.object({ id: z.string().uuid() });

export const listProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: projects, error } = await supabase
      .from("projects")
      .select("id, name, description, created_at, updated_at, pinned_at, product_id, user_id")
      .eq("user_id", userId)
      .order("pinned_at", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);

    // Aggregate doc counts per project
    const { data: docs, error: dErr } = await supabase
      .from("spec_documents")
      .select("project_id, doc_type, group_id")
      .eq("user_id", userId);
    if (dErr) throw new Error(dErr.message);

    const counts = new Map<string, { docs: number; groups: Set<string> }>();
    for (const d of docs ?? []) {
      const pid = (d as { project_id: string | null }).project_id;
      if (!pid) continue;
      if (!counts.has(pid)) counts.set(pid, { docs: 0, groups: new Set() });
      const c = counts.get(pid)!;
      c.docs += 1;
      const gid = (d as { group_id: string | null }).group_id;
      if (gid) c.groups.add(gid);
    }

    // Lookup author + product name for path display in global search.
    const list = projects ?? [];
    const userIds = Array.from(
      new Set(list.map((p) => (p as { user_id: string | null }).user_id).filter((v): v is string => !!v)),
    );
    const productIds = Array.from(
      new Set(list.map((p) => (p as { product_id: string | null }).product_id).filter((v): v is string => !!v)),
    );
    const profilesMap = new Map<string, string>();
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds);
      for (const p of profs ?? []) {
        const dn = (p as { display_name: string | null }).display_name;
        if (dn) profilesMap.set((p as { id: string }).id, dn);
      }
    }
    const productsMap = new Map<string, string>();
    if (productIds.length) {
      const { data: prods } = await supabase.from("products").select("id, name").in("id", productIds);
      for (const p of prods ?? []) {
        productsMap.set((p as { id: string }).id, (p as { name: string }).name);
      }
    }

    return {
      projects: list.map((p) => {
        const c = counts.get(p.id);
        const uid = (p as { user_id: string | null }).user_id;
        const pid = (p as { product_id: string | null }).product_id;
        return {
          ...p,
          pinned_at: (p as { pinned_at: string | null }).pinned_at ?? null,
          doc_count: c?.docs ?? 0,
          group_count: c?.groups.size ?? 0,
          author_name: uid ? profilesMap.get(uid) ?? null : null,
          product_name: pid ? productsMap.get(pid) ?? null : null,
        };
      }),
    };
  });


export const getProject = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: project, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!project) throw new Error("Project not found");

    const { data: specs, error: sErr } = await supabase
      .from("spec_documents")
      .select(
        "id, title, updated_at, created_at, prompt, group_id, model, variant, review_score, doc_type",
      )
      .eq("user_id", userId)
      .eq("project_id", data.id)
      .order("updated_at", { ascending: false });
    if (sErr) throw new Error(sErr.message);

    return { project, specs: specs ?? [] };
  });

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        name: z.string().min(1).max(200),
        description: z.string().max(2000).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("projects")
      .insert({
        user_id: userId,
        name: data.name,
        description: data.description,
      } as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { project: row };
  });

export const updateProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().min(1).max(200).optional(),
        description: z.string().max(2000).optional(),
        business_knowledge: z.string().max(10000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, ...patch } = data;
    const { data: row, error } = await supabase
      .from("projects")
      .update(patch as never)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { project: row };
  });


export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleProjectPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), pinned: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("projects")
      .update({ pinned_at: data.pinned ? new Date().toISOString() : null } as never)
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

