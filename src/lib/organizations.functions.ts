import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OrgKind = "public" | "nonprofit" | "government" | "private";

export type CurrentOrganization = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  address: string | null;
  website: string | null;
  org_kind: OrgKind | null;
  identifier: string | null;
  role: "owner" | "admin" | "member";
} | null;

export const getCurrentOrganization = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CurrentOrganization> => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: membership, error: membershipError } = await supabaseAdmin
      .from("organization_members")
      .select("role, org_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (membershipError) throw new Error(membershipError.message);
    if (!membership?.org_id) return null;

    const { data: org, error: orgError } = await supabaseAdmin
      .from("organizations")
      .select("id, name, slug, logo_url, address, website, org_kind, identifier")
      .eq("id", membership.org_id)
      .maybeSingle();

    if (orgError) throw new Error(orgError.message);
    if (!org) return null;

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      logo_url: org.logo_url ?? null,
      address: org.address ?? null,
      website: org.website ?? null,
      org_kind: org.org_kind ?? null,
      identifier: org.identifier ?? null,
      role: membership.role as "owner" | "admin" | "member",
    };
  });

const UpdateDetailsSchema = z.object({
  org_id: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().max(500).nullable().optional(),
  website: z.string().trim().max(500).nullable().optional(),
  org_kind: z.enum(["public", "nonprofit", "government", "private"]).nullable().optional(),
  identifier: z.string().trim().max(100).nullable().optional(),
});

export const updateOrganizationDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateDetailsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: member } = await supabaseAdmin
      .from("organization_members")
      .select("role")
      .eq("user_id", userId)
      .eq("org_id", data.org_id)
      .maybeSingle();
    if (!member || (member.role !== "owner" && member.role !== "admin")) {
      throw new Error("רק בעלים או מנהל ארגון יכולים לעדכן פרטי ארגון");
    }
    const website = data.website ? data.website.trim() : null;
    const { error } = await supabaseAdmin
      .from("organizations")
      .update({
        name: data.name.trim(),
        address: data.address?.trim() || null,
        website: website || null,
        org_kind: data.org_kind ?? null,
        identifier: data.identifier?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.org_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const UploadSchema = z.object({
  org_id: z.string().uuid(),
  file_base64: z.string().min(10),
  content_type: z.string().min(3).max(100),
  filename: z.string().min(1).max(200),
});

export const uploadOrganizationLogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UploadSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verify the user is owner/admin of the org
    const { data: member, error: memErr } = await supabaseAdmin
      .from("organization_members")
      .select("role")
      .eq("user_id", userId)
      .eq("org_id", data.org_id)
      .maybeSingle();
    if (memErr) throw new Error(memErr.message);
    if (!member || (member.role !== "owner" && member.role !== "admin")) {
      throw new Error("רק בעלים או מנהל ארגון יכולים להעלות לוגו");
    }

    const ext = (data.filename.split(".").pop() || "png").toLowerCase().slice(0, 10);
    const path = `org-logos/${data.org_id}/${Date.now()}.${ext}`;
    const bytes = Uint8Array.from(atob(data.file_base64), (c) => c.charCodeAt(0));

    const up = await supabaseAdmin.storage
      .from("app-assets")
      .upload(path, bytes, { contentType: data.content_type, upsert: true });
    if (up.error) throw new Error(`העלאה נכשלה: ${up.error.message}`);

    const { data: pub } = supabaseAdmin.storage.from("app-assets").getPublicUrl(path);

    const { error: updErr } = await supabaseAdmin
      .from("organizations")
      .update({ logo_url: pub.publicUrl, updated_at: new Date().toISOString() })
      .eq("id", data.org_id);
    if (updErr) throw new Error(updErr.message);

    return { url: pub.publicUrl };
  });

const RemoveSchema = z.object({ org_id: z.string().uuid() });

export const removeOrganizationLogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RemoveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: member } = await supabaseAdmin
      .from("organization_members")
      .select("role")
      .eq("user_id", userId)
      .eq("org_id", data.org_id)
      .maybeSingle();
    if (!member || (member.role !== "owner" && member.role !== "admin")) {
      throw new Error("רק בעלים או מנהל ארגון יכולים להסיר לוגו");
    }
    const { error } = await supabaseAdmin
      .from("organizations")
      .update({ logo_url: null, updated_at: new Date().toISOString() })
      .eq("id", data.org_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
