import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSiteTexts } from "@/lib/site-texts-context";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/signup-requests")({
  head: () => ({
    meta: [{ title: "בקשות הרשמה — Admin" }],
  }),
  component: SignupRequestsPage,
});

type SignupRequest = {
  id: string;
  user_id: string;
  email: string;
  display_name: string | null;
  provider: string;
  status: string;
  requested_at: string;
  reviewed_at: string | null;
};

function SignupRequestsPage() {
  const { isAdmin } = useSiteTexts();
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["signup-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signup_requests")
        .select("*")
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SignupRequest[];
    },
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center">
        <h1 className="text-xl font-semibold">אין הרשאה</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          עמוד זה זמין למנהלי מערכת בלבד.
        </p>
      </div>
    );
  }

  const decide = async (req: SignupRequest, approve: boolean) => {
    setBusyId(req.id);
    try {
      const newStatus = approve ? "approved" : "rejected";
      const { data: authData } = await supabase.auth.getUser();
      const reviewerId = authData.user?.id ?? null;

      const { error: reqErr } = await supabase
        .from("signup_requests")
        .update({
          status: newStatus,
          reviewed_at: new Date().toISOString(),
          reviewed_by: reviewerId,
        })
        .eq("id", req.id);
      if (reqErr) throw reqErr;

      const { error: profErr } = await supabase
        .from("profiles")
        .update({ approval_status: newStatus })
        .eq("id", req.user_id);
      if (profErr) throw profErr;

      toast.success(approve ? "הבקשה אושרה" : "הבקשה נדחתה");
      queryClient.invalidateQueries({ queryKey: ["signup-requests"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "פעולה נכשלה");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 [direction:rtl]">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">בקשות הרשמה</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          אשר או דחה בקשות הרשמה של משתמשים חדשים.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !data || data.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          אין בקשות הרשמה.
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">אימייל</TableHead>
                <TableHead className="text-right">שם</TableHead>
                <TableHead className="text-right">ספק</TableHead>
                <TableHead className="text-right">תאריך</TableHead>
                <TableHead className="text-right">סטטוס</TableHead>
                <TableHead className="text-right">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((req) => (
                <TableRow key={req.id}>
                  <TableCell className="font-medium">{req.email}</TableCell>
                  <TableCell>{req.display_name ?? "—"}</TableCell>
                  <TableCell>{req.provider}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(req.requested_at).toLocaleString("he-IL")}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={req.status} />
                  </TableCell>
                  <TableCell>
                    {req.status === "pending" ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => decide(req, true)}
                          disabled={busyId === req.id}
                        >
                          <Check className="ml-1 h-3.5 w-3.5" />
                          אשר
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => decide(req, false)}
                          disabled={busyId === req.id}
                        >
                          <X className="ml-1 h-3.5 w-3.5" />
                          דחה
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {req.reviewed_at
                          ? new Date(req.reviewed_at).toLocaleString("he-IL")
                          : "—"}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved")
    return <Badge className="bg-emerald-600 hover:bg-emerald-600">מאושר</Badge>;
  if (status === "rejected") return <Badge variant="destructive">נדחה</Badge>;
  return <Badge variant="secondary">ממתין</Badge>;
}
