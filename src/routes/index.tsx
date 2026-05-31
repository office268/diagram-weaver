import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, Sparkles, ListChecks, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditableSiteText } from "@/components/editable-site-text";

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
            <EditableSiteText
              textKey="landing.header.brand"
              defaultValue="סוכן ניתוח מערכות"
            />
          </div>
          <Link to="/login">
            <Button variant="ghost" size="sm">
              <EditableSiteText textKey="landing.header.login" defaultValue="כניסה" />
            </Button>
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-4xl px-6 pt-24 pb-16 text-center">
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            <EditableSiteText
              textKey="landing.hero.badge"
              defaultValue="מסמך אפיון על — בשניות"
            />
          </div>
          <EditableSiteText
            as="h1"
            textKey="landing.hero.title"
            defaultValue="מסמכי אפיון שכותבים את עצמם."
            className="text-balance text-5xl font-bold tracking-tight text-foreground sm:text-6xl block"
          />
          <EditableSiteText
            as="p"
            multiline
            textKey="landing.hero.subtitle"
            defaultValue="תארו את המערכת במילים שלכם — הסוכן יבנה דרישות פונקציונליות, הנחות יסוד, פרסונות, תרחישי שימוש, ארכיטקטורה ומודל נתונים. כל סעיף ניתן לעריכה, מחיקה והוספה."
            className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground block"
          />
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/login">
              <Button size="lg">
                <EditableSiteText
                  textKey="landing.hero.cta"
                  defaultValue="התחילו עכשיו"
                />
              </Button>
            </Link>
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl grid-cols-1 gap-4 px-6 pb-24 sm:grid-cols-3">
          <Feature
            icon={<Sparkles className="h-5 w-5 text-primary" />}
            titleKey="landing.features.1.title"
            titleDefault="יצירה מפרומפט אחד"
            textKey="landing.features.1.text"
            textDefault="פרומפט אחד הופך למסמך אפיון על מלא — דרישות, הנחות יסוד וכל הסעיפים."
          />
          <Feature
            icon={<ListChecks className="h-5 w-5 text-primary" />}
            titleKey="landing.features.2.title"
            titleDefault="עריכה מלאה"
            textKey="landing.features.2.text"
            textDefault="ערכו כל דרישה, הנחה או סעיף. הוסיפו פריטים חדשים או מחקו לפי הצורך."
          />
          <Feature
            icon={<GitBranch className="h-5 w-5 text-primary" />}
            titleKey="landing.features.3.title"
            titleDefault="תרשימים משובצים"
            textKey="landing.features.3.text"
            textDefault="ארכיטקטורה, מודל נתונים ותרחישי שימוש — עם תרשימי Mermaid אינטראקטיביים."
          />
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-6 text-center text-sm text-muted-foreground">
          <EditableSiteText
            textKey="landing.footer"
            defaultValue="סוכן ניתוח מערכות · Lovable Cloud"
          />
        </div>
      </footer>
    </div>
  );
}

function Feature({
  icon,
  titleKey,
  titleDefault,
  textKey,
  textDefault,
}: {
  icon: React.ReactNode;
  titleKey: string;
  titleDefault: string;
  textKey: string;
  textDefault: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
        {icon}
      </div>
      <EditableSiteText
        as="h3"
        textKey={titleKey}
        defaultValue={titleDefault}
        className="font-medium text-foreground block"
      />
      <EditableSiteText
        as="p"
        multiline
        textKey={textKey}
        defaultValue={textDefault}
        className="mt-1 text-sm text-muted-foreground block"
      />
    </div>
  );
}
