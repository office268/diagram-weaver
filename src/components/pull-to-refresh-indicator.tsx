import { Loader2, ArrowDown } from "lucide-react";

interface Props {
  pullDistance: number;
  refreshing: boolean;
  threshold: number;
}

export function PullToRefreshIndicator({ pullDistance, refreshing, threshold }: Props) {
  if (pullDistance <= 0 && !refreshing) return null;
  const progress = Math.min(1, pullDistance / threshold);
  const ready = progress >= 1;
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center md:hidden"
      style={{
        transform: `translateY(${Math.max(0, pullDistance - 20)}px)`,
        transition: refreshing ? "transform 200ms ease-out" : undefined,
      }}
      aria-hidden
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm">
        {refreshing ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : (
          <ArrowDown
            className={`h-4 w-4 transition-transform ${ready ? "rotate-180 text-primary" : ""}`}
            style={{ transform: `rotate(${progress * 180}deg)` }}
          />
        )}
      </div>
    </div>
  );
}
