import { Link, useRouterState } from "@tanstack/react-router";
import { Home, FileText, FolderKanban } from "lucide-react";

interface ItemProps {
  active: boolean;
  icon: React.ReactNode;
  label: string;
}

function ItemInner({ active, icon, label }: ItemProps) {
  return (
    <div
      className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] transition-colors ${
        active ? "text-primary" : "text-muted-foreground"
      }`}
    >
      {active && (
        <span
          aria-hidden
          className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-b-full bg-primary"
        />
      )}
      {icon}
      <span>{label}</span>
    </div>
  );
}

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();

  const isHome = pathname.startsWith("/dashboard");
  const isDocuments = pathname.startsWith("/documents");
  const isProjects = pathname.startsWith("/projects");

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-border bg-card/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="ניווט תחתון"
    >
      <Link to="/dashboard" className="flex-1">
        <ItemInner active={isHome} icon={<Home className="h-5 w-5" />} label="בית" />
      </Link>
      <Link to="/projects" className="flex-1">
        <ItemInner
          active={isProjects}
          icon={<FolderKanban className="h-5 w-5" />}
          label="פרויקטים"
        />
      </Link>
      <Link to="/documents" className="flex-1">
        <ItemInner
          active={isDocuments}
          icon={<FileText className="h-5 w-5" />}
          label="המסמכים שלי"
        />
      </Link>
      {user && (
        <div className="flex flex-1 items-center justify-center py-1.5">
          <UserMenu user={user} />
        </div>
      )}
    </nav>
  );
}
