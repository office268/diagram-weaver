import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ChevronLeft, Loader2, RefreshCw } from "lucide-react";
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

type Grouped = {
  key: string;
  email: string | null;
  lastProvider: string | null;
  lastIp: string | null;
  lastUA: string | null;
  lastAt: string;
  successCount: number;
  errorCount: number;
  signOutCount: number;
  rows: LoginLogRow[];
};

function groupRows(rows: LoginLogRow[]): Grouped[] {
  const map = new Map<string, Grouped>();
  for (const r of rows) {
    const key = r.email ?? "—";
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        email: r.email,
        lastProvider: r.provider,
        lastIp: r.ip,
        lastUA: r.user_agent,
        lastAt: r.created_at,
        successCount: 0,
        errorCount: 0,
        signOutCount: 0,
        rows: [],
      };
      map.set(key, g);
    }
    g.rows.push(r);
    if (r.created_at > g.lastAt) {
      g.lastAt = r.created_at;
      g.lastProvider = r.provider;
      g.lastIp = r.ip;
      g.lastUA = r.user_agent;
    }
    if (r.status === "error") g.errorCount++;
    else if (r.event === "signed_out") g.signOutCount++;
    else g.successCount++;
  }
  for (const g of map.values()) {
    g.rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }
  return Array.from(map.values()).sort((a, b) =>
    a.lastAt < b.lastAt ? 1 : -1,
  );
}

export function LoginLogCard() {
  const fetchLog = useServerFn(getLoginLog);
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["login-log"],
    queryFn: () => fetchLog(),
  });

  const [expanded, setExpanded] = useState<string | null>(null);

  const groups = useMemo(() => (data ? groupRows(data.rows) : []), [data]);

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            {data ? `${groups.length} משתמשים · ${data.rows.length} רשומות` : ""}
            {data && !data.authLogsAvailable ? (
              <span className="block text-amber-600 dark:text-amber-500 mt-1">
                היסטוריה מלאה לא זמינה כרגע — מוצגות רק רשומות מהאפליקציה.
              </span>
            ) : null}
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
        ) : !data || groups.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            עדיין אין רשומות התחברות.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pl-3 font-medium w-6"></th>
                  <th className="py-2 pl-3 font-medium">אימייל</th>
                  <th className="py-2 pl-3 font-medium">הצלחות</th>
                  <th className="py-2 pl-3 font-medium">כישלונות</th>
                  <th className="py-2 pl-3 font-medium">ספק אחרון</th>
                  <th className="py-2 pl-3 font-medium">אחרון</th>
                  <th className="py-2 pl-3 font-medium">IP</th>
                  <th className="py-2 font-medium">דפדפן</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => {
                  const isOpen = expanded === g.key;
                  return (
                    <>
                      <tr
                        key={g.key}
                        className="border-b border-border/50 cursor-pointer hover:bg-muted/40"
                        onClick={() => setExpanded(isOpen ? null : g.key)}
                      >
                        <td className="py-2 pl-3 text-muted-foreground">
                          {isOpen ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronLeft className="h-3.5 w-3.5" />
                          )}
                        </td>
                        <td className="py-2 pl-3 text-foreground font-medium">
                          {g.email ?? "—"}
                        </td>
                        <td className="py-2 pl-3">
                          <Badge className="bg-emerald-600 hover:bg-emerald-600">
                            {g.successCount}
                          </Badge>
                        </td>
                        <td className="py-2 pl-3">
                          {g.errorCount > 0 ? (
                            <Badge variant="destructive">{g.errorCount}</Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="py-2 pl-3 text-muted-foreground">
                          {g.lastProvider ?? "—"}
                        </td>
                        <td className="py-2 pl-3 tabular-nums text-foreground">
                          {formatDate(g.lastAt)}
                        </td>
                        <td className="py-2 pl-3 tabular-nums text-muted-foreground">
                          {g.lastIp ?? "—"}
                        </td>
                        <td className="py-2 text-muted-foreground" title={g.lastUA ?? ""}>
                          {shortUA(g.lastUA)}
                        </td>
                      </tr>
                      {isOpen ? (
                        <tr key={`${g.key}-detail`} className="bg-muted/20">
                          <td colSpan={8} className="p-3">
                            <div className="overflow-x-auto">
                              <table className="w-full text-right text-xs">
                                <thead className="text-muted-foreground">
                                  <tr className="border-b border-border">
                                    <th className="py-2 pl-3 font-medium">זמן</th>
                                    <th className="py-2 pl-3 font-medium">ספק</th>
                                    <th className="py-2 pl-3 font-medium">סטטוס</th>
                                    <th className="py-2 pl-3 font-medium">מקור</th>
                                    <th className="py-2 pl-3 font-medium">IP</th>
                                    <th className="py-2 font-medium">דפדפן</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {g.rows.map((r) => (
                                    <tr key={r.id} className="border-b border-border/40">
                                      <td className="py-2 pl-3 tabular-nums text-foreground">
                                        {formatDate(r.created_at)}
                                      </td>
                                      <td className="py-2 pl-3 text-muted-foreground">
                                        {r.provider ?? "—"}
                                      </td>
                                      <td className="py-2 pl-3">{statusBadge(r)}</td>
                                      <td className="py-2 pl-3">
                                        <Badge variant="outline" className="text-[10px]">
                                          {r.source === "app" ? "אפליקציה" : "Auth"}
                                        </Badge>
                                      </td>
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
                          </td>
                        </tr>
                      ) : null}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
