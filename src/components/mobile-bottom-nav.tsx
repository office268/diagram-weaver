import { Link, useRouterState } from "@tanstack/react-router";
import { Folder, Search, Clock, Settings } from "lucide-react";
import { RecentItemsMenu } from "@/components/recent-items-menu";

function openCommandPalette() {
  window.dispatchEvent(
    new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
  );
}

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

  const isProjects = pathname.startsWith("/projects");
  const isSettings = pathname.startsWith("/settings");

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="ניווט תחתון"
    >
      <Link to="/projects" className="flex-1">
        <ItemInner
          active={isProjects}
          icon={<Folder className="h-5 w-5" />}
          label="פרויקטים"
        />
      </Link>
      <button type="button" onClick={openCommandPalette} className="flex-1" aria-label="חיפוש">
        <ItemInner
          active={false}
          icon={<Search className="h-5 w-5" />}
          label="חיפוש"
        />
      </button>
      <div className="flex flex-1 items-stretch">
        <RecentItemsMenu
          trigger={
            <button type="button" className="flex w-full" aria-label="אחרונים">
              <ItemInner
                active={false}
                icon={<Clock className="h-5 w-5" />}
                label="אחרונים"
              />
            </button>
          }
        />
      </div>
      <Link to="/settings" className="flex-1">
        <ItemInner
          active={isSettings}
          icon={<Settings className="h-5 w-5" />}
          label="הגדרות"
        />
      </Link>
    </nav>
  );
}
