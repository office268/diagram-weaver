import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
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
    <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-4">




      <div className="grid auto-rows-fr grid-cols-3 gap-x-3 gap-y-5 sm:gap-x-4 sm:gap-y-6 lg:gap-5">
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
              className="cube-3d animate-fade-in group relative flex h-36 flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card to-accent/30 p-3 text-center sm:h-44 sm:gap-3 sm:p-4 disabled:opacity-50"
              style={{ animationDelay: `${i * 30}ms`, animationFillMode: "backwards" }}
            >
              <span
                className={`absolute top-2 ${isDiagram ? "left-2" : "right-2"} flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-primary ring-1 ring-primary/20`}
                aria-label="AI"
                title="AI"
              >
                <Sparkles className="h-3 w-3" />
              </span>
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent sm:h-14 sm:w-14 ${t.colorClass}`}>
                {isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin sm:h-7 sm:w-7" />
                ) : (
                  <Icon className="h-5 w-5 sm:h-7 sm:w-7" />
                )}
              </div>
              <div className="min-w-0 px-1">
                <div className="line-clamp-2 text-[11px] font-semibold leading-tight text-foreground sm:text-sm">
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
