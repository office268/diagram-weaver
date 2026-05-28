import { createFileRoute, Link } from "@tanstack/react-router";
import { GitBranch, Code2, Download, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "סוכן ניתוח מערכות | תרשימים מתוך פרומפט" },
      {
        name: "description",
        content:
          "תארו את התהליך במילים — קבלו תרשים מקצועי. עריכה ויזואלית + קוד Mermaid, שמירה בענן, ייצוא ל-SVG/JPG/Mermaid.",
      },
      { property: "og:title", content: "סוכן ניתוח מערכות" },
      {
        property: "og:description",
        content:
          "סוכן AI לאנליסטים שהופך דרישות לתרשימי זרימה, swim-lanes, ER ורצף — תוך שניות.",
      },
      { property: "og:url", content: "/" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <GitBranch className="h-5 w-5 text-primary" />
            סוכן ניתוח מערכות
          </div>
          <Link to="/login">
            <Button variant="ghost" size="sm">כניסה</Button>
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-4xl px-6 pt-24 pb-16 text-center">
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            מטקסט לתרשים — בשניות
          </div>
          <h1 className="text-balance text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
            תרשימי ניתוח שכותבים את עצמם.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
            סוכן AI לאנליסטים שהופך דרישות וטקסט חופשי לתרשימי זרימה, swim-lanes,
            ER ורצף. עריכה ויזואלית וקוד Mermaid זה לצד זה, שמירה בענן וייצוא
            ל-SVG, JPG או ‎.mmd.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/login">
              <Button size="lg">התחילו עכשיו</Button>
            </Link>
            <a
              href="https://mermaid.js.org/intro/"
              target="_blank"
              rel="noreferrer"
            >
              <Button size="lg" variant="outline">מה זה Mermaid</Button>
            </a>
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl grid-cols-1 gap-4 px-6 pb-24 sm:grid-cols-3">
          <Feature
            icon={<GitBranch className="h-5 w-5 text-primary" />}
            title="כל סוגי התרשימים"
            text="זרימה, רצף, מחלקות, מצבים, ER, Gantt ופעילות עם swim-lanes."
          />
          <Feature
            icon={<Code2 className="h-5 w-5 text-primary" />}
            title="יצירה מפרומפט"
            text="כתבו תיאור מילולי של התהליך — הסוכן יבנה את התרשים בשבילכם."
          />
          <Feature
            icon={<Download className="h-5 w-5 text-primary" />}
            title="ייצוא לכל מקום"
            text="הורדה כ-SVG, JPG או קוד Mermaid גולמי — בלי נעילה."
          />
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-6 text-center text-sm text-muted-foreground">
          סוכן ניתוח מערכות · מבוסס Mermaid ו-Lovable Cloud
        </div>
      </footer>
    </div>
  );
}


function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
        {icon}
      </div>
      <h3 className="font-medium text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
