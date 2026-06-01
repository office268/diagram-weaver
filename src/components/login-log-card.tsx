import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getLoginLog, type LoginLogRow } from "@/lib/login-log.functions";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("he-IL", {
      dateStyle: "short",
      timeStyle: "medium",
    });
  } catch {
    return iso;
  }
}

function shortUA(ua: string | null) {
  if (!ua) return "—";
  const m =
    ua.match(/(Chrome|Firefox|Safari|Edge|Opera)[/ ]([\d.]+)/) ||
    ua.match(/(Mobile|Android|iPhone|iPad)/);
  return m ? m[0] : ua.slice(0, 40);
}

function statusBadge(row: LoginLogRow) {
  if (row.status === "error")
    return <Badge variant="destructive">כישלון</Badge>;
  if (row.event === "signed_out")
    return <Badge variant="secondary">יציאה</Badge>;
  return <Badge className="bg-emerald-600 hover:bg-emerald-600">הצלחה</Badge>;
}

export function LoginLogCard() {
  const fetchLog = useServerFn(getLoginLog);
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["login-log"],
    queryFn: () => fetchLog(),
  });

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            {data ? `${data.rows.length} רשומות אחרונות` : ""}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`ml-2 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            רענון
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : isError ? (
          <div className="text-sm text-destructive">
            שגיאה בטעינת הלוג: {(error as Error)?.message}
          </div>
        ) : !data || data.rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            עדיין אין רשומות התחברות.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pl-3 font-medium">זמן</th>
                  <th className="py-2 pl-3 font-medium">אימייל</th>
                  <th className="py-2 pl-3 font-medium">ספק</th>
                  <th className="py-2 pl-3 font-medium">סטטוס</th>
                  <th className="py-2 pl-3 font-medium">IP</th>
                  <th className="py-2 font-medium">דפדפן</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/50">
                    <td className="py-2 pl-3 tabular-nums text-foreground">
                      {formatDate(r.created_at)}
                    </td>
                    <td className="py-2 pl-3 text-foreground">{r.email ?? "—"}</td>
                    <td className="py-2 pl-3 text-muted-foreground">{r.provider ?? "—"}</td>
                    <td className="py-2 pl-3">{statusBadge(r)}</td>
                    <td className="py-2 pl-3 tabular-nums text-muted-foreground">
                      {r.ip ?? "—"}
                    </td>
                    <td className="py-2 text-muted-foreground" title={r.user_agent ?? ""}>
                      {shortUA(r.user_agent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
