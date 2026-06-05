import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { AppBreadcrumb } from "@/components/app-breadcrumb";
import { AgentConfigCard } from "@/components/agent-config-card";
import { getAgentsConfig } from "@/lib/agents-config.functions";
import { useSiteTexts } from "@/lib/site-texts-context";

export const Route = createFileRoute("/_authenticated/agents")({
  head: () => ({
    meta: [
      { title: "סוכנים — תצוגת תצורה" },
      {
        name: "description",
        content:
          "תצוגת כל הסוכנים של מערכת ייצור התוצרים — מודל, פרומפט מערכת, טמפרטורה וכל מה שקובע את ההתנהגות והאיכות.",
      },
    ],
  }),
  component: AgentsPage,
});

function AgentsPage() {
  const { isAdmin } = useSiteTexts();
  const getFn = useServerFn(getAgentsConfig);
  const { data, isLoading, error } = useQuery({
    queryKey: ["agents-config"],
    queryFn: () => getFn(),
    enabled: isAdmin,
  });

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 space-y-6">
      <AppBreadcrumb
        items={[{ label: "פרויקטים", to: "/projects" }, { label: "סוכנים" }]}
      />

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          סוכנים
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          כל הסוכנים שמפעילים את צנרת יצירת מסמכי האפיון — המודל, פרומפט המערכת,
          הטמפרטורה, מבנה הפרומפט, ותפקידם בלולאת השיפור.
        </p>
      </div>

      {!isAdmin ? (
        <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          דף זה זמין למנהלי מערכת בלבד.
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          טעינת תצורת הסוכנים נכשלה: {(error as Error).message}
        </div>
      ) : data ? (
        <>
          <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-foreground/80">
            <span className="font-semibold">מודל ברירת מחדל גלובלי: </span>
            <code className="font-mono">{data.defaultModel}</code>
            <span className="mr-2 text-muted-foreground">
              · ניתן לשנות בעמוד ההגדרות
            </span>
          </div>
          <div className="space-y-4">
            {data.agents.map((a) => (
              <AgentConfigCard key={a.key} agent={a} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
