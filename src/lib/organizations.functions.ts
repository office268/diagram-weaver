import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CurrentOrganization = {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "admin" | "member";
} | null;

export const getCurrentOrganization = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CurrentOrganization> => {
    const { supabase, userId } = context;

    const { data, error } = await supabase
      .from("organization_members")
      .select("role, org_id, organizations:org_id ( id, name, slug )")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data || !data.organizations) return null;

    const org = data.organizations as unknown as { id: string; name: string; slug: string };
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      role: data.role as "owner" | "admin" | "member",
    };
  });
