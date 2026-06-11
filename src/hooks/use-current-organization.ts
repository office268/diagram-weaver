// ============================================================
// src/hooks/use-current-organization.ts
// Hook — use-current-organization
// ============================================================
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { getCurrentOrganization } from "@/lib/organizations.functions";

const LEGACY_CACHE_KEY = "current-organization-cache-v1";

export function useCurrentOrganization() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const fetchCurrentOrganization = useServerFn(getCurrentOrganization);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(LEGACY_CACHE_KEY);
    } catch {
      // ignore legacy cache cleanup failures
    }
  }, []);

  return useQuery({
    queryKey: ["current-organization", userId],
    queryFn: async () => {
      if (!userId) return null;
      return fetchCurrentOrganization();
    },
    enabled: !!userId,
    staleTime: 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: true,
    retry: 1,
  });
}
