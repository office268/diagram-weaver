// ============================================================
// src/hooks/use-credits.ts
// Hook — use-credits
// ============================================================
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";

export function useCredits() {
  const { user } = useAuth();
  const userId = user?.id;

  const query = useQuery({
    queryKey: ["credits", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("credits")
        .select("balance")
        .eq("user_id", userId!)
        .maybeSingle();
      return data?.balance ?? 0;
    },
  });

  useRealtimeInvalidate("credits", "credits", userId, ["credits", userId]);

  return { balance: query.data ?? 0, loading: query.isLoading };
}
