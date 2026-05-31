import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clock, FileText, Folder } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { listRecentItems } from "@/lib/recent.functions";

interface RecentItemsMenuProps {
  trigger?: React.ReactNode;
}

export function RecentItemsMenu({ trigger }: RecentItemsMenuProps = {}) {
  const listFn = useServerFn(listRecentItems);
  const { data } = useQuery({
    queryKey: ["recent-items"],
    queryFn: () => listFn(),
  });

  const docs = data?.docs?.slice(0, 5) ?? [];
  const projects = data?.projects?.slice(0, 3) ?? [];
  const isEmpty = docs.length === 0 && projects.length === 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger ?? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="פריטים אחרונים"
          >
            <Clock className="h-4 w-4" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>פריטים אחרונים</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isEmpty && (
          <div className="px-2 py-6 text-center text-xs text-muted-foreground">
            עוד אין פעילות אחרונה.
          </div>
        )}
        {docs.length > 0 && (
          <div className="px-1 pb-1">
            <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              מסמכים
            </div>
            {docs.map((d) => (
              <Link
                key={d.id}
                to="/editor/$id"
                params={{ id: d.id }}
                className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent"
              >
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{d.title}</span>
              </Link>
            ))}
          </div>
        )}
        {projects.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="px-1 pb-1">
              <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                פרויקטים
              </div>
              {projects.map((p) => (
                <Link
                  key={p.id}
                  to="/projects/$projectId"
                  params={{ projectId: p.id }}
                  className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent"
                >
                  <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{p.name}</span>
                </Link>
              ))}
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
