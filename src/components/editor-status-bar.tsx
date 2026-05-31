import { Type, ListChecks } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface EditorStatusBarProps {
  wordCount: number;
  filledCount: number;
  totalCount: number;
}

export function EditorStatusBar({
  wordCount,
  filledCount,
  totalCount,
}: EditorStatusBarProps) {
  const pct = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0;
  return (
    <div className="sticky bottom-0 z-30 border-t border-border bg-card/85 px-4 py-1.5 backdrop-blur supports-[backdrop-filter]:bg-card/70">
      <div className="mx-auto flex max-w-4xl items-center gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5" title="סך מילים במסמך">
          <Type className="h-3.5 w-3.5" />
          <span>{wordCount.toLocaleString("he-IL")}</span>
          <span className="hidden sm:inline">מילים</span>
        </div>
        <div className="flex items-center gap-1.5" title="סעיפים שמולאו">
          <ListChecks className="h-3.5 w-3.5" />
          <span>
            {filledCount} / {totalCount}
          </span>
          <span className="hidden sm:inline">סעיפים</span>
        </div>
        <div className="ml-auto flex min-w-[8rem] items-center gap-2">
          <Progress value={pct} className="h-1 flex-1" />
          <span className="w-9 text-right tabular-nums">{pct}%</span>
        </div>
      </div>
    </div>
  );
}
