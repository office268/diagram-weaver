import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAiUsage, type AiUsageRow } from "@/lib/ai-usage.functions";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function fmtNumber(n: number) {
  return new Intl.NumberFormat("he-IL").format(n);
}
function fmtUsd(n: number) {
  return `$${(n ?? 0).toFixed(4)}`;
}
function fmtDate(s: string) {
  try {
    return new Date(s).toLocaleString("he-IL");
  } catch {
    return s;
  }
}

export function AiUsageCard() {
  const fn = useServerFn(listAiUsage);
  const { data, isLoading, error } = useQuery({
    queryKey: ["ai-usage"],
    queryFn: () => fn(),
  });

  const rows: AiUsageRow[] = data?.rows ?? [];
  const isAdmin = !!data?.isAdmin;

  const totals = rows.reduce(
    (acc, r) => {
      acc.words += r.word_count ?? 0;
      acc.input += r.prompt_tokens ?? 0;
      acc.output += r.completion_tokens ?? 0;
      acc.total += r.total_tokens ?? 0;
      acc.cost += Number(r.cost_usd ?? 0);
      const key =
        r.artifact_kind === "spec_document"
          ? `s:${r.spec_document_id ?? ""}`
          : `d:${r.diagram_id ?? ""}`;
      acc.artifacts.add(key);
      return acc;
    },
    {
      words: 0,
      input: 0,
      output: 0,
      total: 0,
      cost: 0,
      artifacts: new Set<string>(),
    },
  );

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <SummaryTile label="פריטים" value={fmtNumber(totals.artifacts.size)} />
          <SummaryTile label="פעולות AI" value={fmtNumber(rows.length)} />
          <SummaryTile label="סך מילים" value={fmtNumber(totals.words)} />
          <SummaryTile label="סך טוקנים" value={fmtNumber(totals.total)} />
          <SummaryTile label="סך עלות" value={fmtUsd(totals.cost)} />
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">טוען נתונים…</div>
        ) : error ? (
          <div className="text-sm text-destructive">
            שגיאה בטעינת נתוני שימוש.
          </div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            אין עדיין פעילות מתועדת.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">תאריך</TableHead>
                  <TableHead className="text-right">מסמך</TableHead>
                  {isAdmin ? <TableHead className="text-right">משתמש</TableHead> : null}
                  <TableHead className="text-right">סוג</TableHead>
                  <TableHead className="text-right">פעולה</TableHead>
                  <TableHead className="text-right">מודל</TableHead>
                  <TableHead className="text-right">מילים</TableHead>
                  <TableHead className="text-right">Input</TableHead>
                  <TableHead className="text-right">Output</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">עלות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const title =
                    r.current_title ?? r.doc_title ?? "(ללא כותרת)";
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {fmtDate(r.created_at)}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate">
                        <span className="font-medium">{title}</span>
                        {r.status === "failed" ? (
                          <span
                            className="mr-2 inline-flex items-center rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] text-destructive"
                            title={r.error_message ?? "נכשל"}
                          >
                            נכשל
                          </span>
                        ) : r.is_deleted ? (
                          <span className="mr-2 inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            נמחק
                          </span>
                        ) : null}
                      </TableCell>
                      {isAdmin ? (
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {r.user_email ?? "—"}
                        </TableCell>
                      ) : null}
                      <TableCell className="text-xs text-muted-foreground">
                        {r.doc_type ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs">{r.purpose}</TableCell>
                      <TableCell className="text-xs">{r.model}</TableCell>
                      <TableCell>{fmtNumber(r.word_count ?? 0)}</TableCell>
                      <TableCell>{fmtNumber(r.prompt_tokens)}</TableCell>
                      <TableCell>{fmtNumber(r.completion_tokens)}</TableCell>
                      <TableCell>{fmtNumber(r.total_tokens)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {fmtUsd(Number(r.cost_usd ?? 0))}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
