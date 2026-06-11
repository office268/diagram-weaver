// ============================================================
// src/routes/_authenticated.tsx
// Route — _authenticated.tsx
// מסך/דף ב-TanStack Router (file-based routing)
// ============================================================
import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, Workflow } from "lucide-react";
import { toast } from "sonner";


import { useAuth } from "@/hooks/use-auth";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { UserMenu } from "@/components/navigation/user-menu";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

import { RecentItemsMenu } from "@/components/navigation/recent-items-menu";
import {
  GlobalCommandPalette,
  CommandTriggerButton,
} from "@/components/navigation/global-command-palette";

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
              asChild
              variant="ghost"
              size="icon"
              className="ms-auto h-10 w-10"
              aria-label="חיפוש מסמכים"
            >
              <Link to="/documents">
                <Search className="h-5 w-5" />
              </Link>
            </Button>
            <HamburgerMenu />

          </div>
          <div className="mx-4 mt-3 h-px bg-gradient-to-r from-transparent via-border to-transparent" aria-hidden />

        </header>

        <main className="flex-1">
          <Outlet />
        </main>
        <footer className="hidden md:block border-t border-border bg-card">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-center gap-3 px-4 py-3 text-xs text-muted-foreground">
            <nav className="mx-auto flex items-center justify-center gap-8">
              <Link to="/terms" className="hover:text-foreground">תנאי שימוש</Link>
              <Link to="/privacy" className="hover:text-foreground">פרטיות</Link>
              <Link to="/about" className="hover:text-foreground">אודות</Link>
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
      className="inline-flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="דף הארגון"
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt={data?.name ?? ""} className="h-full w-full object-cover" />
      ) : (
        <Workflow className="h-8 w-8 text-muted-foreground" />
      )}
    </Link>
  );
}

function HamburgerMenu() {
  const { user } = useAuth();
  if (!user) return null;
  return <UserMenu user={user} trigger="hamburger" />;
}

function OrgNameLabel() {
  const { user } = useAuth();
  const { data, isLoading } = useCurrentOrganization();
  return (
    <div className="flex min-w-0 flex-col items-start gap-0.5">
      {isLoading ? (
        <span className="h-3 w-20 animate-pulse rounded bg-muted" aria-hidden />
      ) : data ? (
        <Link
          to="/organization"
          className="min-w-0 truncate text-base font-medium text-foreground hover:underline"
          title={data.name}
        >
          {data.name}
        </Link>
      ) : null}
      {user?.email ? (
        <span className="whitespace-nowrap text-xs leading-tight text-muted-foreground" dir="ltr">
          {user.email}
        </span>
      ) : null}
    </div>
  );
}


