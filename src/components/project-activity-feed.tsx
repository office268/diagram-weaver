// ============================================================
// src/components/project-activity-feed.tsx
// רכיב UI — project-activity-feed
// ============================================================
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Activity, FilePlus2, FilePen } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";
import { getDocTypeVisual } from "@/lib/doc-types";

interface SpecRow {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  doc_type?: string;
}

interface Props {
  specs: SpecRow[];
  limit?: number;
}

type Event = {
  kind: "created" | "updated";
  at: string;
  spec: SpecRow;
};

/**
 * Derive a recent-activity feed from the spec list. Each doc gives a "created"
 * event and, when updated_at > created_at, an additional "updated" event.
 */
export function ProjectActivityFeed({ specs, limit = 8 }: Props) {
  const events = useMemo<Event[]>(() => {
    const out: Event[] = [];
    for (const s of specs) {
      out.push({ kind: "created", at: s.created_at, spec: s });
      // Treat as "updated" only when the diff is meaningful (>2s).
      if (new Date(s.updated_at).getTime() - new Date(s.created_at).getTime() > 2000) {
        out.push({ kind: "updated", at: s.updated_at, spec: s });
      }
    }
    out.sort((a, b) => +new Date(b.at) - +new Date(a.at));
    return out.slice(0, limit);
  }, [specs, limit]);

  if (events.length === 0) return null;

  return (
    <section
      aria-label="פעילות אחרונה בפרויקט"
      className="rounded-xl border border-border bg-card/50 p-4"
    >
      <header className="mb-3 flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">פעילות אחרונה</h2>
      </header>
      <ol className="space-y-2.5">
        {events.map((e, i) => {
          const v = getDocTypeVisual(e.spec.doc_type ?? null);
          const TypeIcon = v.icon;
          const KindIcon = e.kind === "created" ? FilePlus2 : FilePen;
          const verb = e.kind === "created" ? "נוצר" : "עודכן";
          let rel = "";
          try {
            rel = formatDistanceToNow(new Date(e.at), { addSuffix: true, locale: he });
          } catch {
            rel = new Date(e.at).toLocaleDateString("he-IL");
          }
          return (
            <li key={`${e.spec.id}-${e.kind}-${i}`} className="flex items-start gap-2.5 text-sm">
              <KindIcon
                className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                  e.kind === "created" ? "text-emerald-500" : "text-muted-foreground"
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">{verb}</span>
                  <TypeIcon className={`h-3.5 w-3.5 ${v.colorClass}`} />
                  <Link
                    to="/editor/$id"
                    params={{ id: e.spec.id }}
                    className="truncate font-medium text-foreground hover:text-primary hover:underline"
                  >
                    {e.spec.title}
                  </Link>
                </div>
                <div className="text-[11px] text-muted-foreground">{rel}</div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
