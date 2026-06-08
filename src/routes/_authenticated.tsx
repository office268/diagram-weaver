import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Workflow, KanbanSquare, Rocket, Search, X, Menu } from "lucide-react";
import { toast } from "sonner";


import { useAuth } from "@/hooks/use-auth";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { UserMenu } from "@/components/user-menu";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

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

  // Approval gate
  const { data: approvalData, isLoading: approvalLoading } = useQuery({
    queryKey: ["approval-status", user?.id ?? null],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("approval_status")
        .eq("id", user.id)
        .maybeSingle();
      return data?.approval_status ?? "pending";
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const handledRef = useRef(false);
  useEffect(() => {
    if (!user || approvalLoading) return;
    if (approvalData && approvalData !== "approved") {
      if (handledRef.current) return;
      handledRef.current = true;
      const msg =
        approvalData === "rejected"
          ? "בקשת הרישום שלך נדחתה."
          : "בקשת הרישום שלך ממתינה לאישור מנהל.";
      toast.info(msg, { duration: 6000 });
      // Sign out first, then navigate after the auth event has settled,
      // so we don't race AuthBridge's router.invalidate() with our navigation.
      supabase.auth.signOut().finally(() => {
        navigate({ to: "/pending-approval", replace: true });
      });
    }
  }, [approvalData, approvalLoading, user, navigate]);

  if (loading || !user || approvalLoading || (approvalData && approvalData !== "approved")) {
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
            <HamburgerMenu />

          </div>
          {searchOpen && (
            <GlobalSearchBar onNavigate={() => setSearchOpen(false)} />
          )}
          <div className="mx-4 mt-3 h-px bg-gradient-to-r from-transparent via-border to-transparent" aria-hidden />
          <ActiveModuleTitle />

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
  const avatarUrl = data?.logo_url ?? null;
  return (
    <Link
      to="/organization"
      className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-muted outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="דף הארגון"
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt={data?.name ?? ""} className="h-full w-full object-cover" />
      ) : (
        <Workflow className="h-5 w-5 text-muted-foreground" />
      )}
    </Link>
  );
}

function HamburgerMenu() {
  const { user } = useAuth();
  if (!user) return null;
  return <UserMenu user={user} trigger="hamburger" />;
}

function ActiveModuleTitle() {
  const location = useLocation();
  const path = location.pathname;
  let title: string | null = null;
  let Icon: typeof Workflow | null = null;
  if (
    path.startsWith("/dashboard") ||
    path.startsWith("/chat") ||
    path.startsWith("/diagram") ||
    path.startsWith("/editor") ||
    path.startsWith("/documents")
  ) {
    title = "ניתוח מערכות";
    Icon = Workflow;
  } else if (path.startsWith("/projects-management") || path.startsWith("/projects")) {
    title = "ניהול פרויקטים";
    Icon = KanbanSquare;
  } else if (path.startsWith("/product")) {
    title = "ניהול מוצר";
    Icon = Rocket;
  }
  if (!title || !Icon) return <div className="py-3" aria-hidden />;
  return (
    <div className="flex w-full items-center justify-between gap-3 px-4 py-4 sm:py-5 [direction:rtl]">
      <div className="relative flex items-center gap-2 mx-auto">
        <Icon className="h-5 w-5 text-foreground sm:h-6 sm:w-6" />
        <span className="text-sm font-semibold text-foreground sm:text-base">{title}</span>
        <span className="absolute -bottom-2 left-1/2 h-0.5 w-12 -translate-x-1/2 rounded-full bg-primary" />
      </div>
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
  );
}




function OrgNameLabel() {
  const { data, isLoading } = useCurrentOrganization();
  if (isLoading) {
    return <span className="h-3 w-20 animate-pulse rounded bg-muted" aria-hidden />;
  }
  if (!data) return null;
  return (
    <Link
      to="/organization"
      className="text-sm font-medium text-foreground truncate min-w-0 hover:underline"
      title={data.name}
    >
      {data.name}
    </Link>
  );
}


