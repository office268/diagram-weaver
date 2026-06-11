// ============================================================
// src/routes/pending-approval.tsx
// Route — pending-approval.tsx
// מסך/דף ב-TanStack Router (file-based routing)
// ============================================================
import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/pending-approval")({
  head: () => ({
    meta: [
      { title: "ממתין לאישור — System Analyst Assist" },
      { name: "description", content: "בקשת הרישום שלך ממתינה לאישור מנהל." },
    ],
  }),
  component: PendingApprovalPage,
});

function PendingApprovalPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Clock className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          הבקשה ממתינה לאישור
        </h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          בקשת הרישום שלך נשלחה למנהל המערכת. בשעות הקרובות תקבל אישור ופרטי
          כניסה במייל.
        </p>
        <div className="mt-6">
          <Button asChild variant="outline" className="w-full">
            <Link to="/">חזרה לעמוד הכניסה</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
