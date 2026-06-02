import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2, Workflow, KanbanSquare, Rocket } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { UserMenu } from "@/components/user-menu";

import { RecentItemsMenu } from "@/components/recent-items-menu";
import {
  GlobalCommandPalette,
  CommandTriggerButton,
} from "@/components/global-command-palette";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { OnboardingProvider } from "@/components/onboarding/onboarding-provider";
import { OnboardingOverlay } from "@/components/onboarding/onboarding-overlay";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();


  useEffect(() => {
    if (!loading && !user) navigate({ to: "/", replace: true });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <OnboardingProvider>
      <div className="flex min-h-screen flex-col bg-background">
        <header className="relative border-b border-border bg-card">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3">
            <div data-tour="user-menu">
              <UserMenu user={user} />
            </div>

            <nav className="flex items-center gap-1.5 sm:gap-2">
              <Link
                to="/dashboard"
                className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/15 sm:text-sm"
              >
                <Workflow className="h-4 w-4" />
                <span>ניתוח מערכות</span>
              </Link>
              <button
                type="button"
                onClick={() => toast.info("ניהול פרויקט — בקרוב")}
                className="relative flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent sm:text-sm"
              >
                <KanbanSquare className="h-4 w-4" />
                <span>ניהול פרויקט</span>
                <span className="absolute -top-1.5 -end-1.5 rounded-full bg-muted px-1 py-0.5 text-[8px] font-medium text-muted-foreground">בקרוב</span>
              </button>
              <button
                type="button"
                onClick={() => toast.info("ניהול מוצר — בקרוב")}
                className="relative flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent sm:text-sm"
              >
                <Rocket className="h-4 w-4" />
                <span>ניהול מוצר</span>
                <span className="absolute -top-1.5 -end-1.5 rounded-full bg-muted px-1 py-0.5 text-[8px] font-medium text-muted-foreground">בקרוב</span>
              </button>
            </nav>

            <div className="relative flex items-center gap-1.5">
              <div className="hidden md:flex items-center gap-1.5">
                <Link
                  to="/documents"
                  className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  המסמכים שלי
                </Link>
                <div data-tour="header-search">
                  <CommandTriggerButton />
                </div>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 pb-16 md:pb-0">
          <Outlet />
        </main>
        <footer className="hidden md:block border-t border-border bg-card">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs text-muted-foreground">
            <span>סוכן ניתוח מערכות · Lovable Cloud</span>
            <nav className="flex items-center gap-4">
              <Link to="/about" className="hover:text-foreground">אודות</Link>
              <Link to="/privacy" className="hover:text-foreground">פרטיות</Link>
              <Link to="/terms" className="hover:text-foreground">תנאי שימוש</Link>
            </nav>
          </div>
        </footer>
        <div data-tour="mobile-nav">
          <MobileBottomNav />
        </div>
        <GlobalCommandPalette />
        <OnboardingOverlay />
      </div>
    </OnboardingProvider>
  );
}
