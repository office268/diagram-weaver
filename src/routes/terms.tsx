import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "תנאי שימוש — סוכן ניתוח מערכות" },
      { name: "description", content: "תנאי השימוש בסוכן ניתוח מערכות." },
      { property: "og:title", content: "תנאי שימוש — סוכן ניתוח מערכות" },
      { property: "og:url", content: "/terms" },
    ],
    links: [{ rel: "canonical", href: "/terms" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← חזרה</Link>
      <h1 className="mt-4 text-3xl font-semibold text-foreground">תנאי שימוש</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          השימוש בסוכן ניתוח מערכות כפוף לתנאים הבאים. בעצם השימוש בשירות, אתם מאשרים שקראתם
          והסכמתם לתנאים אלו.
        </p>
        <p>
          תוכן שנוצר על ידי מודלי AI נועד לסיוע בלבד. אחריות סופית על נכונות ומלאות מסמכי האפיון
          חלה עליכם.
        </p>
        <p>
          אסור להשתמש בשירות לפעילות לא חוקית, לפרסום תוכן פוגעני או לניסיון לעקוף אבטחה.
        </p>
      </div>
    </div>
  );
}
