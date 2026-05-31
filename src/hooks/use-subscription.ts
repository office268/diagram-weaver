import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getPaddleEnvironment } from "@/lib/paddle";

export function useSubscription() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const env = getPaddleEnvironment();

  const query = useQuery({
    queryKey: ["subscription", userId, env],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId!)
        .eq("environment", env)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`subs-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${userId}` },
        () => queryClient.invalidateQueries({ queryKey: ["subscription", userId, env] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, env, queryClient]);

  const sub = query.data;
  const isActive =
    !!sub &&
    ((["active", "trialing", "past_due"].includes(sub.status) &&
      (!sub.current_period_end || new Date(sub.current_period_end) > new Date())) ||
      (sub.status === "canceled" &&
        sub.current_period_end &&
        new Date(sub.current_period_end) > new Date()));

  return { subscription: sub, isActive, loading: query.isLoading };
}
