import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCurrentOrganization } from "@/lib/organizations.functions";
import { useAuth } from "@/hooks/use-auth";

export function useCurrentOrganization() {
  const { user } = useAuth();
  const fetchOrg = useServerFn(getCurrentOrganization);

  return useQuery({
    queryKey: ["current-organization", user?.id ?? null],
    queryFn: () => fetchOrg(),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}
