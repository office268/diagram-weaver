import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Cpu, Check, Loader2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { updateChatThreadModel } from "@/lib/chat.functions";
import { getAvailableAgentModels } from "@/lib/ai-model-setting.functions";
import { MODEL_LABELS, modelShortLabel } from "@/lib/ai-model-labels";
import { cn } from "@/lib/utils";

interface Props {
  threadId: string;
  currentOverride: string | null;
  variant?: "default" | "compact";
}

export function ThreadModelSelector({ threadId, currentOverride, variant = "default" }: Props) {
  const qc = useQueryClient();
  const getModelsFn = useServerFn(getAvailableAgentModels);
  const updateFn = useServerFn(updateChatThreadModel);
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["available-agent-models"],
    queryFn: () => getModelsFn(),
    staleTime: 5 * 60_000,
  });

  const allowed = data?.allowed ?? [];
  const adminDefault = data?.adminDefault ?? null;
  const effective = currentOverride ?? adminDefault;

  const mutation = useMutation({
    mutationFn: (model: string | null) => updateFn({ data: { threadId, model } }),
    onSuccess: (_res, model) => {
      toast.success(
        model ? `המודל הוחלף ל-${modelShortLabel(model)}` : "חזרה למודל ברירת המחדל",
      );
      qc.invalidateQueries({ queryKey: ["chat-thread", threadId] });
      setOpen(false);
    },
    onError: (err: Error) => {
      toast.error("שינוי המודל נכשל: " + err.message);
    },
  });

  const triggerLabel = effective ? modelShortLabel(effective) : "מודל";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isLoading || mutation.isPending}
          className={cn(
            "h-8 gap-2 rounded-full border-dashed text-xs font-normal",
            variant === "compact" && "h-7 px-2.5",
          )}
          title="המודל שיופעל ביצירת התוצר. ניתן להחליף בכל עת."
          aria-label={`מודל נוכחי: ${triggerLabel}`}
        >
          {mutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : (
            <Cpu className="h-3.5 w-3.5 text-primary" />
          )}
          <span className="text-muted-foreground">מודל:</span>
          <span className="font-medium text-foreground">{triggerLabel}</span>
          {currentOverride && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              שיחה
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-80 p-1.5">

        <button
          type="button"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate(null)}
          className={cn(
            "flex w-full items-start gap-2 rounded-md px-2 py-2 text-right text-sm hover:bg-accent disabled:opacity-60",
            currentOverride === null && "bg-accent/60",
          )}
        >
          <Check
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0",
              currentOverride === null ? "text-primary" : "text-transparent",
            )}
          />
          <div className="flex-1">
            <div className="font-medium">ברירת מחדל של המערכת</div>
            <div className="text-xs text-muted-foreground">
              {adminDefault ? modelShortLabel(adminDefault) : "—"}
            </div>
          </div>
        </button>
        <div className="my-1 h-px bg-border" />
        <div className="max-h-72 overflow-y-auto">
          {allowed.map((m) => {
            const selected = currentOverride === m;
            return (
              <button
                key={m}
                type="button"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate(m)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-md px-2 py-2 text-right text-sm hover:bg-accent disabled:opacity-60",
                  selected && "bg-accent/60",
                )}
              >
                <Check
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    selected ? "text-primary" : "text-transparent",
                  )}
                />
                <div className="flex-1">
                  <div className="font-medium">{modelShortLabel(m)}</div>
                  <div className="text-xs text-muted-foreground">
                    {MODEL_LABELS[m] ?? m}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
