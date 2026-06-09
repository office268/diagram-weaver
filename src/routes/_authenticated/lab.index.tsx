import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/lab/")({
  component: LabIndex,
});

function LabIndex() {
  const navigate = useNavigate();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) {
        navigate({ to: "/", replace: true });
        return;
      }
      const { data, error } = await supabase
        .from("lab_sessions")
        .insert({ user_id: userId, title: "סשן חדש" })
        .select("id")
        .single();
      if (error || !data) {
        console.error("[lab] create session failed", error);
        return;
      }
      navigate({ to: "/lab/$sessionId", params: { sessionId: data.id }, replace: true });
    })();
  }, [navigate]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
