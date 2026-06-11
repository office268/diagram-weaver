// ============================================================
// src/components/diagrams/editor-status-bar.tsx
// רכיב UI — editor-status-bar
// ============================================================
import { Type, ListChecks, Coins, DollarSign } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface EditorStatusBarProps {
  wordCount: number;
  filledCount: number;
  totalCount: number;
  totalTokens: number | null;
  totalCostUsd: number | null;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("he-IL");
}

function formatCost(usd: number): string {
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd >= 0.01) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(4)}`;
}

export function EditorStatusBar({
  wordCount,
  filledCount,
  totalCount,
  totalTokens,
  totalCostUsd,
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
        <div className="flex items-center gap-1.5" title="טוקנים מצטברים בכל קריאות ה-AI על המסמך">
          <Coins className="h-3.5 w-3.5" />
          <span className="tabular-nums">
            {totalTokens === null ? "—" : formatTokens(totalTokens)}
          </span>
          <span className="hidden sm:inline">טוקנים</span>
        </div>
        <div className="flex items-center gap-1.5" title="עלות מצטברת ב-USD">
          <DollarSign className="h-3.5 w-3.5" />
          <span className="tabular-nums">
            {totalCostUsd === null ? "—" : formatCost(totalCostUsd)}
          </span>
        </div>
        <div className="ml-auto flex min-w-[8rem] items-center gap-2">
          <Progress value={pct} className="h-1 flex-1" />
          <span className="w-9 text-right tabular-nums">{pct}%</span>
        </div>
      </div>
    </div>
  );
}
