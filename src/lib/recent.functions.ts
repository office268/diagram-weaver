// ============================================================
// src/lib/recent.functions.ts
// Server function (createServerFn) — recent.functions.ts
// נקודת RPC מהלקוח לשרת
// ============================================================
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listRecentItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [docsRes, projectsRes] = await Promise.all([
      supabase
        .from("spec_documents")
        .select("id, title, updated_at, doc_type, project_id")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(8),
      supabase
        .from("projects")
        .select("id, name, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(5),
    ]);

    if (docsRes.error) throw new Error(docsRes.error.message);
    if (projectsRes.error) throw new Error(projectsRes.error.message);

    return {
      docs: docsRes.data ?? [],
      projects: projectsRes.data ?? [],
    };
  });
