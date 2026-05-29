import type { SpecReview } from "@/lib/spec-output-schema";

export function ReviewPanel({ review }: { review: SpecReview }) {
  const tone =
    review.score >= 8
      ? "border-primary/40 bg-primary/5"
      : review.score >= 5
        ? "border-amber-500/40 bg-amber-500/5"
        : "border-destructive/40 bg-destructive/5";
  return (
    <div className={`rounded-md border p-3 ${tone}`}>
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-foreground">סוכן מבקר איכות</div>
        <div className="rounded-full border border-border bg-background px-2 py-0.5 text-xs font-semibold">
          ציון: {review.score}/10
        </div>
      </div>
      {review.notes.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">אין הערות — המסמך מצוין.</p>
      ) : (
        <ul className="mt-2 list-disc space-y-1 pr-5 text-xs text-foreground">
          {review.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
