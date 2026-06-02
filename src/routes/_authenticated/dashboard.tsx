import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Sparkles, Workflow, KanbanSquare, Rocket } from "lucide-react";
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

type CategoryKey = "systems" | "project" | "product";

const CATEGORIES: {
  key: CategoryKey;
  label: string;
  icon: typeof Workflow;
  enabled: boolean;
}[] = [
  { key: "systems", label: "ניתוח מערכות", icon: Workflow, enabled: true },
  { key: "project", label: "ניהול פרויקט", icon: KanbanSquare, enabled: false },
  { key: "product", label: "ניהול מוצר", icon: Rocket, enabled: false },
];

function HomePage() {
  const navigate = useNavigate();
  const createFn = useServerFn(createChatThread);
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("systems");

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
      <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.key;
          return (
            <button
              key={cat.key}
              type="button"
              disabled={!cat.enabled}
              onClick={() => cat.enabled && setActiveCategory(cat.key)}
              className={`relative flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-center transition-all sm:flex-row sm:gap-2 sm:p-4 ${
                isActive
                  ? "border-primary/40 bg-primary/10 text-primary shadow-sm"
                  : cat.enabled
                    ? "border-border bg-card text-foreground hover:border-primary/30 hover:bg-accent"
                    : "cursor-not-allowed border-border/40 bg-muted/30 text-muted-foreground opacity-60"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0 sm:h-4 sm:w-4" />
              <span className="text-xs font-semibold sm:text-sm">{cat.label}</span>
              {!cat.enabled && (
                <span className="absolute -top-1.5 end-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                  בקרוב
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeCategory === "systems" ? (
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
                  className={`absolute top-2 end-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent ring-1 ring-border/60 ${t.colorClass}`}
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
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">
          קטגוריה זו תכלול בקרוב מסמכים, תרשימים וכלים ייעודיים.
        </div>
      )}
    </div>
  );
}
