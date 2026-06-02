import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { OUTPUT_TYPES, OUTPUT_TYPE_ORDER, type OutputKey } from "@/lib/output-types";
import { createChatThread } from "@/lib/chat.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "סוכן ניתוח מערכות — בית" },
      { name: "description", content: "בחר/י סוג מסמך או תרשים ליצירה." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const createFn = useServerFn(createChatThread);

  const createMut = useMutation({
    mutationFn: (outputType: OutputKey) =>
      createFn({ data: { outputType, title: OUTPUT_TYPES[outputType].label } }),
    onSuccess: (res) => {
      navigate({ to: "/chat/$threadId", params: { threadId: res.thread.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "יצירה נכשלה"),
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          מה ניצור היום?
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          בחר/י סוג מסמך או תרשים והתחל/י לתאר במילים שלך.
        </p>
      </div>

      <div className="grid auto-rows-fr grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
        {OUTPUT_TYPE_ORDER.map((key, i) => {
          const t = OUTPUT_TYPES[key];
          const Icon = t.icon;
          const isPending = createMut.isPending && createMut.variables === key;
          const isDiagram = t.category === "diagram";
          return (
            <button
              key={key}
              type="button"
              disabled={createMut.isPending}
              onClick={() => createMut.mutate(key)}
              className="cube-3d animate-fade-in group relative flex h-32 flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card to-accent/30 p-3 text-center sm:h-40 sm:gap-3 sm:p-4 disabled:opacity-50"
              style={{ animationDelay: `${i * 30}ms`, animationFillMode: "backwards" }}
            >
              <span
                className={`absolute top-2.5 ${isDiagram ? "left-2.5" : "right-2.5"} rounded-full bg-muted/80 px-2 py-0.5 text-[10px] text-muted-foreground`}
              >
                {isDiagram ? "תרשים" : "מסמך"}
              </span>
              <div className={`flex h-14 w-14 items-center justify-center rounded-xl bg-accent ${t.colorClass}`}>
                {isPending ? (
                  <Loader2 className="h-7 w-7 animate-spin" />
                ) : (
                  <Icon className="h-7 w-7" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold leading-tight text-foreground sm:text-base">
                  {t.label}
                </div>
                <p className="mt-1 hidden text-xs text-muted-foreground sm:block">
                  {t.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
