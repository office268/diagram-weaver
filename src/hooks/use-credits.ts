import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export function useCredits() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
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

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`credits-${userId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "credits", filter: `user_id=eq.${userId}` },
        () => queryClient.invalidateQueries({ queryKey: ["credits", userId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return { balance: query.data ?? 0, loading: query.isLoading };
}
