import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, Sparkles, ListChecks, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "סוכן ניתוח מערכות | מסמכי אפיון על מתוך פרומפט" },
      {
        name: "description",
        content:
          "תארו מערכת במילים חופשיות — קבלו מסמך אפיון על מלא: דרישות, הנחות יסוד, תרחישים, ארכיטקטורה ומודל נתונים. הכל ניתן לעריכה.",
      },
      { property: "og:title", content: "סוכן ניתוח מערכות" },
      {
        property: "og:description",
        content:
          "סוכן AI לאנליסטים שמייצר מסמכי אפיון על מלאים מתוך תיאור מילולי של המערכת.",
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
            <FileText className="h-5 w-5 text-primary" />
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
            מסמך אפיון על — בשניות
          </div>
          <h1 className="text-balance text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
            מסמכי אפיון שכותבים את עצמם.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
            תארו את המערכת במילים שלכם — הסוכן יבנה דרישות פונקציונליות, הנחות יסוד,
            פרסונות, תרחישי שימוש, ארכיטקטורה ומודל נתונים. כל סעיף ניתן לעריכה,
            מחיקה והוספה.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/login">
              <Button size="lg">התחילו עכשיו</Button>
            </Link>
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl grid-cols-1 gap-4 px-6 pb-24 sm:grid-cols-3">
          <Feature
            icon={<Sparkles className="h-5 w-5 text-primary" />}
            title="יצירה מפרומפט אחד"
            text="פרומפט אחד הופך למסמך אפיון על מלא — דרישות, הנחות יסוד וכל הסעיפים."
          />
          <Feature
            icon={<ListChecks className="h-5 w-5 text-primary" />}
            title="עריכה מלאה"
            text="ערכו כל דרישה, הנחה או סעיף. הוסיפו פריטים חדשים או מחקו לפי הצורך."
          />
          <Feature
            icon={<GitBranch className="h-5 w-5 text-primary" />}
            title="תרשימים משובצים"
            text="ארכיטקטורה, מודל נתונים ותרחישי שימוש — עם תרשימי Mermaid אינטראקטיביים."
          />
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-6 text-center text-sm text-muted-foreground">
          סוכן ניתוח מערכות · Lovable Cloud
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
