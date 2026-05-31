import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "מדיניות פרטיות — סוכן ניתוח מערכות" },
      { name: "description", content: "מדיניות הפרטיות של סוכן ניתוח מערכות." },
      { property: "og:title", content: "מדיניות פרטיות — סוכן ניתוח מערכות" },
      { property: "og:url", content: "/privacy" },
    ],
    links: [{ rel: "canonical", href: "/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← חזרה</Link>
      <h1 className="mt-4 text-3xl font-semibold text-foreground">מדיניות פרטיות</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          אנו מכבדים את פרטיות המשתמשים. הנתונים שלכם (מסמכי האפיון, הפרומפטים וההגדרות)
          מאוחסנים באופן מאובטח ונגישים אך ורק לכם.
        </p>
        <p>
          אימייל וסיסמה נשמרים במערכת האימות (Supabase). מסמכים שאתם יוצרים מאוחסנים בבסיס הנתונים
          תחת חשבונכם בלבד, ומוגנים על ידי מדיניות RLS.
        </p>
        <p>
          איננו משתפים מידע אישי עם צדדים שלישיים, פרט לספקי תשתית הכרחיים (Supabase, ספקי מודלי AI)
          ולמטרה של מתן השירות בלבד.
        </p>
      </div>
    </div>
  );
}
