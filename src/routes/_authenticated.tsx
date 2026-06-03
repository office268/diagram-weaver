import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Workflow, KanbanSquare, Rocket, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

import { useAuth } from "@/hooks/use-auth";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { UserMenu } from "@/components/user-menu";
import { Button } from "@/components/ui/button";

import { RecentItemsMenu } from "@/components/recent-items-menu";
import {
  GlobalCommandPalette,
  CommandTriggerButton,
} from "@/components/global-command-palette";
import { GlobalSearchBar } from "@/components/global-search-bar";

import { OnboardingProvider } from "@/components/onboarding/onboarding-provider";
import { OnboardingOverlay } from "@/components/onboarding/onboarding-overlay";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isDashboard = location.pathname.startsWith("/dashboard");
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    setSearchOpen(false);
  }, [location.pathname]);


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
        <header className="border-b border-border bg-card">
          <div className="flex w-full items-center justify-start gap-2 px-4 pt-3 [direction:rtl]" data-tour="user-menu">
            <UserMenuWithOrgLogo />
            <OrgNameLabel />
            <Button
              variant="ghost"
              size="icon"
              className="ms-auto h-8 w-8"
              aria-label={searchOpen ? "סגור חיפוש" : "פתח חיפוש"}
              onClick={() => setSearchOpen((v) => !v)}
            >
              {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          {searchOpen && (
            <GlobalSearchBar onNavigate={() => setSearchOpen(false)} />
          )}
          <div className="flex w-full items-stretch justify-between gap-0 px-4 py-5 sm:py-6 divide-x divide-border [direction:ltr]">



            <Link
              to="/dashboard"
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-1 text-xs font-semibold text-foreground transition-opacity hover:opacity-80 sm:text-sm [direction:rtl]",
              )}
            >
              <Workflow className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="flex flex-col items-center leading-tight"><span>ניתוח</span><span>מערכות</span></span>
              {isDashboard && (
                <span className="absolute -bottom-3 left-1/2 h-0.5 w-10 -translate-x-1/2 rounded-full bg-primary sm:-bottom-4" />
              )}
            </Link>

            <Link
              to="/projects-management"
              className="relative flex flex-1 flex-col items-center justify-center gap-1 text-xs font-semibold text-foreground transition-opacity hover:opacity-80 sm:text-sm [direction:rtl]"
            >
              <KanbanSquare className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="flex flex-col items-center leading-tight"><span>ניהול</span><span>פרויקטים</span></span>
              {location.pathname.startsWith("/projects-management") && (
                <span className="absolute -bottom-3 left-1/2 h-0.5 w-10 -translate-x-1/2 rounded-full bg-primary sm:-bottom-4" />
              )}
            </Link>


            <Link
              to="/product"
              className="relative flex flex-1 flex-col items-center justify-center gap-1 text-xs font-semibold text-foreground transition-opacity hover:opacity-80 sm:text-sm [direction:rtl]"
            >
              <Rocket className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="flex flex-col items-center leading-tight"><span>ניהול</span><span>מוצר</span></span>
              {location.pathname.startsWith("/product") && (
                <span className="absolute -bottom-3 left-1/2 h-0.5 w-10 -translate-x-1/2 rounded-full bg-primary sm:-bottom-4" />
              )}
            </Link>


            <div className="hidden md:flex flex-1 items-center justify-center gap-1.5">
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
        </header>

        <main className="flex-1">
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
        <GlobalCommandPalette />
        <OnboardingOverlay />
      </div>
    </OnboardingProvider>
  );
}

function UserMenuWithOrgLogo() {
  const { user } = useAuth();
  const { data } = useCurrentOrganization();
  if (!user) return null;
  return <UserMenu user={user} overrideAvatarUrl={data?.logo_url ?? null} />;
}

function OrgNameLabel() {
  const { data, isLoading } = useCurrentOrganization();
  if (isLoading) {
    return <span className="h-3 w-20 animate-pulse rounded bg-muted" aria-hidden />;
  }
  if (!data) return null;
  return (
    <span className="text-sm font-medium text-foreground truncate min-w-0" title={data.name}>
      {data.name}
    </span>
  );
}

