// ============================================================
// src/components/diagrams/review-suggestions-panel.tsx
// רכיב UI — review-suggestions-panel
// ============================================================
import { useMemo } from "react";
import { Loader2, Sparkles, Check, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SpecReview, ReviewNote } from "@/lib/spec/output-schema";

const SCORE_CRITERIA = [
  "שלמות — האם כל הסעיפים הנדרשים מכוסים",
  "בהירות — האם הניסוחים חד-משמעיים",
  "עקביות — אין סתירות פנימיות בין סעיפים",
  "ישימות — ניתן לממש מבחינה טכנית/עסקית",
  "בדיקות — קל לגזור קריטריוני קבלה ובדיקות",
];

function importanceTone(importance: number): string {
  if (importance >= 8) return "bg-destructive/15 text-destructive border-destructive/40";
  if (importance >= 5) return "bg-amber-500/15 text-amber-700 border-amber-500/40 dark:text-amber-400";
  return "bg-muted text-muted-foreground border-border";
}

export function ReviewSuggestionsPanel({
  review,
  selected,
  onToggle,
  onSelectAll,
  onClear,
  onImprove,
  onFinish,
  improving,
  disabled,
}: {
  review: SpecReview;
  selected: Set<string>;
  onToggle: (noteId: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onImprove: () => void;
  onFinish: () => void;
  improving: boolean;
  disabled?: boolean;
}) {
  const sortedNotes: ReviewNote[] = useMemo(
    () => [...review.notes].sort((a, b) => b.importance - a.importance),
    [review.notes],
  );
  const hasNotes = sortedNotes.length > 0;
  const selectedCount = sortedNotes.filter((n) => selected.has(n.id)).length;

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border p-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            הצעות לשיפור מסוכן הביקורת
          </span>
        </div>
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex cursor-help items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-xs font-semibold">
                ציון: {review.score}/10
                <Info className="h-3 w-3 text-muted-foreground" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="end" className="max-w-xs">
              <div className="space-y-1 text-right">
                <div className="font-semibold">קריטריונים לציון</div>
                <ul className="space-y-0.5 text-[11px] opacity-90">
                  {SCORE_CRITERIA.map((c) => (
                    <li key={c}>• {c}</li>
                  ))}
                </ul>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {!hasNotes ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          הסוכן לא מצא הצעות שיפור — המסמך מצוין.
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <span>
              נבחרו {selectedCount} מתוך {sortedNotes.length}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="hover:text-foreground"
                onClick={onSelectAll}
                disabled={disabled || improving}
              >
                בחר הכל
              </button>
              <span aria-hidden>·</span>
              <button
                type="button"
                className="hover:text-foreground"
                onClick={onClear}
                disabled={disabled || improving}
              >
                נקה
              </button>
            </div>
          </div>
          <ul className="max-h-80 divide-y divide-border overflow-y-auto">
            {sortedNotes.map((n) => {
              const isSelected = selected.has(n.id);
              return (
                <li key={n.id} className="flex items-start gap-3 p-3">
                  <Checkbox
                    id={`note-${n.id}`}
                    checked={isSelected}
                    disabled={disabled || improving}
                    onCheckedChange={() => onToggle(n.id)}
                    className="mt-0.5"
                  />
                  <label
                    htmlFor={`note-${n.id}`}
                    className="flex flex-1 cursor-pointer items-start gap-2 text-sm text-foreground"
                  >
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${importanceTone(n.importance)}`}
                      title="דירוג חשיבות 1-10"
                    >
                      {n.importance}
                    </span>
                    <span className="flex-1">{n.text}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border p-3">
        <Button variant="ghost" onClick={onFinish} disabled={improving}>
          <Check className="mr-1.5 h-4 w-4" />
          סיים ופתח לעריכה
        </Button>
        <Button
          onClick={onImprove}
          disabled={improving || disabled || selectedCount === 0}
        >
          {improving ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-1.5 h-4 w-4" />
          )}
          צור גרסה משופרת ({selectedCount})
        </Button>
      </div>
    </div>
  );
}
