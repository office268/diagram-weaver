import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { FileText, Loader2 } from "lucide-react";
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
  const location = useLocation();
  const isDashboard = location.pathname === "/dashboard";


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
            <Link to="/dashboard" className="relative flex shrink-0 items-center gap-2 font-semibold text-foreground">

              <FileText className="h-5 w-5 text-primary" />
              <span className="hidden sm:inline">סוכן ניתוח מערכות</span>
            </Link>

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
              
              <div data-tour="user-menu">
                <UserMenu user={user} />
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
