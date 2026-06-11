// ============================================================
// src/components/ui/skeleton.tsx
// shadcn primitive — skeleton
// רכיב UI בסיסי (shadcn/ui) — לא לערוך עיצוב גלובלי כאן
// ============================================================
import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-primary/10", className)} {...props} />;
}

export { Skeleton };
