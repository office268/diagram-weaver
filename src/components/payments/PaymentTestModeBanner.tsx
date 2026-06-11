// ============================================================
// src/components/payments/PaymentTestModeBanner.tsx
// רכיב UI — PaymentTestModeBanner
// ============================================================
import { getPaddleEnvironment } from "@/lib/payments/paddle";

export function PaymentTestModeBanner() {
  if (getPaddleEnvironment() !== "sandbox") return null;

  return (
    <div className="w-full bg-orange-100 border-b border-orange-300 px-4 py-2 text-center text-xs text-orange-800">
      כל התשלומים בתצוגה מקדימה הם במצב בדיקה (test mode).{" "}
      <a
        href="https://docs.lovable.dev/features/payments#test-and-live-environments"
        target="_blank"
        rel="noopener noreferrer"
        className="underline font-medium"
      >
        קרא עוד
      </a>
    </div>
  );
}
