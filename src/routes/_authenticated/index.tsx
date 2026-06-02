import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { OUTPUT_TYPES, OUTPUT_TYPE_ORDER, type OutputKey } from "@/lib/output-types";
import { createChatThread } from "@/lib/chat.functions";

export const Route = createFileRoute("/_authenticated/")({
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {OUTPUT_TYPE_ORDER.map((key, i) => {
          const t = OUTPUT_TYPES[key];
          const Icon = t.icon;
          const isPending = createMut.isPending && createMut.variables === key;
          return (
            <button
              key={key}
              type="button"
              disabled={createMut.isPending}
              onClick={() => createMut.mutate(key)}
              className="hover-lift animate-fade-in group relative flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-5 text-right transition-all hover:border-primary/40 hover:shadow-lg disabled:opacity-50"
              style={{ animationDelay: `${i * 30}ms`, animationFillMode: "backwards" }}
            >
              <div className={`flex h-11 w-11 items-center justify-center rounded-lg bg-accent ${t.colorClass}`}>
                {isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{t.label}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                    {t.category === "diagram" ? "תרשים" : "מסמך"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
