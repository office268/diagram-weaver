// ============================================================
// src/hooks/use-subscription.ts
// Hook — use-subscription
// ============================================================
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getPaddleEnvironment } from "@/lib/payments/paddle";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";

export function useSubscription() {
  const { user } = useAuth();
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

  useRealtimeInvalidate("subs", "subscriptions", userId, ["subscription", userId, env]);

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
