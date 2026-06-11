// ============================================================
// src/routes/pricing.tsx
// Route — pricing.tsx
// מסך/דף ב-TanStack Router (file-based routing)
// ============================================================
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, Gift, Sparkles, Zap, Package } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { openCheckout } from "@/lib/payments/paddle";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { toast } from "sonner";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "מחירים — סוכן ניתוח מערכות" },
      {
        name: "description",
        content: "התחל חינם עם 30 קרדיטים. מנוי חודשי $20 (125 קרדיטים), חבילה $20 (100 קרדיטים) או חבילה $50 (250 קרדיטים).",
      },
      { property: "og:title", content: "מחירים — סוכן ניתוח מערכות" },
      { property: "og:url", content: "/pricing" },
    ],
    links: [{ rel: "canonical", href: "/pricing" }],
  }),
  component: PricingPage,
});

function PricingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleBuy = async (priceId: string) => {
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    setLoadingId(priceId);
    try {
      await openCheckout({ priceId, userId: user.id, email: user.email ?? undefined });
    } catch (e) {
      toast.error("שגיאה בפתיחת התשלום");
      console.error(e);
    } finally {
      setLoadingId(null);
    }
  };

  const handleFree = () => {
    if (!user) navigate({ to: "/signup" });
    else navigate({ to: "/projects" });
  };

  return (
    <div className="min-h-screen bg-background">
      <PaymentTestModeBanner />
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← חזרה
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">
            תוכניות ומחירים
          </h1>
          <p className="mt-3 text-muted-foreground">
            כל מסמך אפיון שיוצרים = 1 קרדיט. בחרו את המסלול שמתאים לכם.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Free */}
          <div className="rounded-2xl border border-border bg-card p-8">
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-emerald-500" />
              <h2 className="text-xl font-semibold text-foreground">חינם</h2>
            </div>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-bold text-foreground">$0</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">30 קרדיטים להתחלה</p>
            <ul className="mt-6 space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 text-primary" />
                <span>30 מסמכי אפיון</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 text-primary" />
                <span>ללא כרטיס אשראי</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 text-primary" />
                <span>מתנה חד-פעמית בהרשמה</span>
              </li>
            </ul>
            <Button variant="outline" className="mt-8 w-full" size="lg" onClick={handleFree}>
              {user ? "המשך לאפליקציה" : "התחל עכשיו"}
            </Button>
          </div>

          {/* Monthly subscription */}
          <div className="relative rounded-2xl border-2 border-primary bg-card p-8 shadow-lg">
            <div className="absolute -top-3 right-6 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
              מומלץ
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">מנוי חודשי</h2>
            </div>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-bold text-foreground">$20</span>
              <span className="text-muted-foreground">/ חודש</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">125 קרדיטים בכל חודש</p>
            <ul className="mt-6 space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 text-primary" />
                <span>125 מסמכי אפיון בחודש</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 text-primary" />
                <span>חידוש אוטומטי כל חודש</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 text-primary" />
                <span>ביטול בכל עת — גישה עד סוף התקופה</span>
              </li>
            </ul>
            <Button
              className="mt-8 w-full"
              size="lg"
              onClick={() => handleBuy("monthly_subscription")}
              disabled={loadingId === "monthly_subscription"}
            >
              {loadingId === "monthly_subscription" ? "טוען..." : "התחל מנוי"}
            </Button>
          </div>

          {/* 100 pack */}
          <div className="rounded-2xl border border-border bg-card p-8">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              <h2 className="text-xl font-semibold text-foreground">חבילה קטנה</h2>
            </div>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-bold text-foreground">$20</span>
              <span className="text-muted-foreground">/ חד-פעמי</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">100 קרדיטים, ללא תפוגה</p>
            <ul className="mt-6 space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 text-primary" />
                <span>100 מסמכי אפיון</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 text-primary" />
                <span>ללא התחייבות חודשית</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 text-primary" />
                <span>קרדיטים נשארים לתמיד</span>
              </li>
            </ul>
            <Button
              variant="outline"
              className="mt-8 w-full"
              size="lg"
              onClick={() => handleBuy("credits_100")}
              disabled={loadingId === "credits_100"}
            >
              {loadingId === "credits_100" ? "טוען..." : "קנה חבילה"}
            </Button>
          </div>

          {/* 250 pack */}
          <div className="relative rounded-2xl border border-border bg-card p-8">
            <div className="absolute -top-3 right-6 rounded-full bg-amber-500 px-3 py-1 text-xs font-medium text-white">
              משתלם
            </div>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-amber-600" />
              <h2 className="text-xl font-semibold text-foreground">חבילה גדולה</h2>
            </div>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-bold text-foreground">$50</span>
              <span className="text-muted-foreground">/ חד-פעמי</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">250 קרדיטים, ללא תפוגה</p>
            <ul className="mt-6 space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 text-primary" />
                <span>250 מסמכי אפיון</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 text-primary" />
                <span>חיסכון של 20% לעומת החבילה הקטנה</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 text-primary" />
                <span>קרדיטים נשארים לתמיד</span>
              </li>
            </ul>
            <Button
              variant="outline"
              className="mt-8 w-full"
              size="lg"
              onClick={() => handleBuy("credits_250")}
              disabled={loadingId === "credits_250"}
            >
              {loadingId === "credits_250" ? "טוען..." : "קנה חבילה"}
            </Button>
          </div>
        </div>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          התשלומים מבוצעים דרך Paddle, ספק התשלומים שלנו (Merchant of Record).{" "}
          <Link to="/refund-policy" className="underline">מדיניות החזרים</Link> ·{" "}
          <Link to="/terms" className="underline">תנאי שימוש</Link>
        </p>
      </main>
    </div>
  );
}
