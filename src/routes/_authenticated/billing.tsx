// ============================================================
// src/routes/_authenticated/billing.tsx
// מסך מאומת (Authenticated route) — billing.tsx
// דורש משתמש מחובר; יושב תחת layout _authenticated
// ============================================================
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { CreditCard, Sparkles, Zap, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCredits } from "@/hooks/use-credits";
import { useSubscription } from "@/hooks/use-subscription";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { openCustomerPortal } from "@/lib/paddle";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/billing")({
  component: BillingPage,
});

function BillingPage() {
  const { user } = useAuth();
  const { balance } = useCredits();
  const { subscription, isActive } = useSubscription();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      toast.success("התשלום התקבל! הקרדיטים יתעדכנו תוך כמה שניות.");
    }
  }, []);

  const { data: transactions } = useQuery({
    queryKey: ["credit-transactions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("credit_transactions")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  return (
    <div>
      <PaymentTestModeBanner />
      <div className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-3xl font-semibold text-foreground">חיוב וקרדיטים</h1>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {/* Credits balance */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Zap className="h-4 w-4" />
              <span className="text-sm">יתרת קרדיטים</span>
            </div>
            <div className="mt-2 text-4xl font-bold text-foreground">{balance}</div>
            <p className="mt-1 text-xs text-muted-foreground">כל מסמך אפיון = 1 קרדיט</p>
          </div>

          {/* Subscription */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm">מנוי</span>
            </div>
            {subscription ? (
              <>
                <div className="mt-2 text-lg font-semibold text-foreground">
                  {subscription.price_id === "monthly_subscription"
                    ? "מנוי חודשי"
                    : subscription.price_id}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  סטטוס: {subscription.status}
                  {subscription.cancel_at_period_end && " (יבוטל בסוף התקופה)"}
                </p>
                {subscription.current_period_end && (
                  <p className="text-xs text-muted-foreground">
                    {subscription.cancel_at_period_end ? "גישה עד" : "חידוש ב"}:{" "}
                    {new Date(subscription.current_period_end).toLocaleDateString("he-IL")}
                  </p>
                )}
              </>
            ) : (
              <div className="mt-2 text-sm text-muted-foreground">ללא מנוי פעיל</div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/pricing">
              <CreditCard className="ml-2 h-4 w-4" />
              {isActive ? "קנה קרדיטים נוספים" : "צפה במחירים"}
            </Link>
          </Button>
          {subscription && (
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await openCustomerPortal();
                } catch (e) {
                  toast.error("שגיאה בפתיחת ניהול המנוי");
                  console.error(e);
                }
              }}
            >
              <ExternalLink className="ml-2 h-4 w-4" />
              נהל מנוי (Paddle)
            </Button>
          )}
        </div>

        {/* History */}
        <div className="mt-10">
          <h2 className="text-xl font-semibold text-foreground">היסטוריית קרדיטים</h2>
          <div className="mt-4 rounded-xl border border-border bg-card overflow-hidden">
            {transactions?.length ? (
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr className="text-right text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium">תאריך</th>
                    <th className="px-4 py-2 font-medium">פעולה</th>
                    <th className="px-4 py-2 font-medium">כמות</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr key={t.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2 text-muted-foreground">
                        {new Date(t.created_at).toLocaleString("he-IL")}
                      </td>
                      <td className="px-4 py-2 text-foreground">{t.description ?? t.kind}</td>
                      <td
                        className={`px-4 py-2 font-medium ${
                          t.amount > 0 ? "text-emerald-600" : "text-foreground"
                        }`}
                      >
                        {t.amount > 0 ? "+" : ""}
                        {t.amount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-6 text-center text-sm text-muted-foreground">
                אין פעולות עדיין
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
