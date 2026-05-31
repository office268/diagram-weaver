import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { FileText, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { UserMenu } from "@/components/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3">
          <Link to="/projects" className="flex items-center gap-2 font-semibold text-foreground">
            <FileText className="h-5 w-5 text-primary" />
            סוכן ניתוח מערכות
          </Link>

          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <UserMenu user={user} />
          </div>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs text-muted-foreground">
          <span>סוכן ניתוח מערכות · Lovable Cloud</span>
          <nav className="flex items-center gap-4">
            <Link to="/about" className="hover:text-foreground">אודות</Link>
            <Link to="/privacy" className="hover:text-foreground">פרטיות</Link>
            <Link to="/terms" className="hover:text-foreground">תנאי שימוש</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
