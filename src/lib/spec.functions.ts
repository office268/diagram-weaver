import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const idSchema = z.object({ id: z.string().uuid() });

export const listSpecs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("spec_documents")
      .select(
        "id, title, updated_at, created_at, prompt, group_id, model, variant, review_score",
      )
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { specs: data ?? [] };
  });

export const getSpec = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("spec_documents")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Document not found");
    return { spec: row };
  });

export const createSpec = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        title: z.string().min(1).max(200),
        prompt: z.string().max(5000).default(""),
        content: z.record(z.string(), z.any()).default({}),
        reviewScore: z.number().int().min(1).max(10).nullable().optional(),
        reviewNotes: z.array(z.string()).max(50).optional(),
        groupId: z.string().uuid().optional(),
        model: z.string().max(100).optional(),
        variant: z.enum(["original", "revised", "single"]).optional(),
        docType: z.string().max(60).optional(),
        sectionOrder: z.array(z.string().max(60)).max(50).optional(),
        sectionTitles: z.record(z.string().max(60), z.string().max(200)).optional(),
        projectId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("spec_documents")
      .insert({
        user_id: userId,
        title: data.title,
        prompt: data.prompt,
        content: data.content,
        review_score: data.reviewScore ?? null,
        review_notes: data.reviewNotes ?? [],
        group_id: data.groupId ?? null,
        model: data.model ?? null,
        variant: data.variant ?? null,
        doc_type: data.docType ?? "spec_overview",
        section_order: data.sectionOrder ?? [],
        section_titles: data.sectionTitles ?? {},
        project_id: data.projectId ?? null,
      } as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { spec: row };
  });


export const deleteSpecGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ groupId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("spec_documents")
      .delete()
      .eq("group_id", data.groupId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateGroupPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        groupId: z.string().uuid(),
        prompt: z.string().min(1).max(5000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("spec_documents")
      .update({ prompt: data.prompt } as never)
      .eq("group_id", data.groupId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });



export const updateSpec = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().min(1).max(200).optional(),
        content: z.record(z.string(), z.any()).optional(),
        userNotes: z.string().max(10000).optional(),
        userPrompt: z.string().max(5000).optional(),
        sectionOrder: z.array(z.string().max(60)).max(50).optional(),
        sectionTitles: z.record(z.string().max(60), z.string().max(200)).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, userNotes, userPrompt, sectionOrder, sectionTitles, ...rest } = data;
    const patch: {
      title?: string;
      content?: Record<string, unknown>;
      user_notes?: string;
      user_prompt?: string;
      section_order?: string[];
      section_titles?: Record<string, string>;
    } = { ...rest };
    if (userNotes !== undefined) patch.user_notes = userNotes;
    if (userPrompt !== undefined) patch.user_prompt = userPrompt;
    if (sectionOrder !== undefined) patch.section_order = sectionOrder;
    if (sectionTitles !== undefined) patch.section_titles = sectionTitles;
    const { data: row, error } = await supabase
      .from("spec_documents")
      .update(patch as never)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { spec: row };
  });

export const deleteSpec = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("spec_documents")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
