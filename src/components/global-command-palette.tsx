import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Folder,
  FileText,
  FolderPlus,
  Settings,
  Sun,
  Moon,
  Search,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { listProjects } from "@/lib/project.functions";
import { listRecentItems } from "@/lib/recent.functions";
import { useTheme } from "@/hooks/use-theme";

export function GlobalCommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const listProjectsFn = useServerFn(listProjects);
  const listRecentFn = useServerFn(listRecentItems);

  const { data: projData } = useQuery({
    queryKey: ["projects"],
    queryFn: () => listProjectsFn(),
    enabled: open,
  });
  const { data: recentData } = useQuery({
    queryKey: ["recent-items"],
    queryFn: () => listRecentFn(),
    enabled: open,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        // Ignore if a contenteditable / textarea owns focus AND already binds Cmd+K
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName;
        const editable = target?.isContentEditable;
        if (editable || tag === "TEXTAREA" || tag === "INPUT") {
          // Still allow palette to open — most app inputs don't bind Cmd+K
        }
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (fn: () => void) => {
    setOpen(false);
    // Defer to next tick so dialog closes cleanly
    setTimeout(fn, 0);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="חפש פרויקטים, מסמכים או פעולות..." />
      <CommandList>
        <CommandEmpty>לא נמצאו תוצאות.</CommandEmpty>

        {recentData?.docs && recentData.docs.length > 0 && (
          <>
            <CommandGroup heading="מסמכים אחרונים">
              {recentData.docs.slice(0, 6).map((d) => (
                <CommandItem
                  key={d.id}
                  value={`doc ${d.title}`}
                  onSelect={() =>
                    go(() => navigate({ to: "/editor/$id", params: { id: d.id } }))
                  }
                >
                  <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{d.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {projData?.projects && projData.projects.length > 0 && (
          <>
            <CommandGroup heading="פרויקטים">
              {projData.projects.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`project ${p.name} ${p.description ?? ""}`}
                  onSelect={() =>
                    go(() =>
                      navigate({ to: "/projects/$projectId", params: { projectId: p.id } }),
                    )
                  }
                >
                  <Folder className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{p.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="פעולות">
          <CommandItem
            value="new project פרויקט חדש"
            onSelect={() => go(() => navigate({ to: "/projects" }))}
          >
            <FolderPlus className="mr-2 h-4 w-4" />
            פרויקט חדש
            <CommandShortcut>פתח רשימה</CommandShortcut>
          </CommandItem>
          <CommandItem
            value="settings הגדרות"
            onSelect={() => go(() => navigate({ to: "/settings" }))}
          >
            <Settings className="mr-2 h-4 w-4" />
            הגדרות
          </CommandItem>
          <CommandItem
            value="theme toggle ערכה כהה בהיר"
            onSelect={() => go(() => setTheme(theme === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? (
              <Sun className="mr-2 h-4 w-4" />
            ) : (
              <Moon className="mr-2 h-4 w-4" />
            )}
            החלף ערכה ({theme === "dark" ? "בהירה" : "כהה"})
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

export function CommandTriggerButton() {
  return (
    <button
      type="button"
      onClick={() => {
        // Dispatch synthetic Cmd+K
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
        );
      }}
      className="hidden items-center gap-2 rounded-md border border-border bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted sm:inline-flex"
      aria-label="פתח חיפוש (Cmd+K)"
    >
      <Search className="h-3.5 w-3.5" />
      <span>חיפוש</span>
      <kbd className="rounded border border-border bg-background px-1 font-mono text-[10px]">
        ⌘K
      </kbd>
    </button>
  );
}
