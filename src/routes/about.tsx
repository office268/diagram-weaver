import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "אודות — סוכן ניתוח מערכות" },
      { name: "description", content: "אודות סוכן ניתוח מערכות — כלי AI לאנליסטים." },
      { property: "og:title", content: "אודות — סוכן ניתוח מערכות" },
      { property: "og:url", content: "/about" },
    ],
    links: [{ rel: "canonical", href: "/about" }],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← חזרה</Link>
      <h1 className="mt-4 text-3xl font-semibold text-foreground">אודות</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          סוכן ניתוח מערכות נבנה כדי לעזור לאנליסטים, מנהלי מוצר וצוותי פיתוח להפוך תיאורים מילוליים
          למסמכי אפיון מלאים בשניות.
        </p>
        <p>
          המסמכים ניתנים לעריכה ידנית מלאה, וכוללים סוכן ביקורת שמציע שיפורים ודרישות חסרות.
        </p>
      </div>
    </div>
  );
}
