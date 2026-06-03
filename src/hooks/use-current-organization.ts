import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { CurrentOrganization, OrgKind } from "@/lib/organizations.functions";

const CACHE_KEY = "current-organization-cache-v1";

function readCache(userId: string): CurrentOrganization | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { userId: string; data: CurrentOrganization };
    if (parsed.userId !== userId) return undefined;
    return parsed.data;
  } catch {
    return undefined;
  }
}

function writeCache(userId: string, data: CurrentOrganization) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ userId, data }));
  } catch {
    // ignore
  }
}

async function fetchCurrentOrganization(): Promise<CurrentOrganization> {
  const { data, error } = await supabase
    .from("organization_members")
    .select(
      "role, org_id, organizations:org_id ( id, name, slug, logo_url, address, website, org_kind, identifier )",
    )
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data || !data.organizations) return null;

  const org = data.organizations as unknown as {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    address: string | null;
    website: string | null;
    org_kind: OrgKind | null;
    identifier: string | null;
  };
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    logo_url: org.logo_url ?? null,
    address: org.address ?? null,
    website: org.website ?? null,
    org_kind: org.org_kind ?? null,
    identifier: org.identifier ?? null,
    role: data.role as "owner" | "admin" | "member",
  };
}

export function useCurrentOrganization() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  return useQuery({
    queryKey: ["current-organization", userId],
    queryFn: async () => {
      const data = await fetchCurrentOrganization();
      if (userId) writeCache(userId, data);
      return data;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    initialData: userId ? readCache(userId) : undefined,
    initialDataUpdatedAt: 0,
  });
}
